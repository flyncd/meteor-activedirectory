Future = Npm.require('fibers/future');

// At a minimum, set up LDAP_DEFAULTS.url and .dn according to
// your needs. url should appear as 'ldap://your.url.here'
// dn should appear in normal ldap format of comma separated attribute=value
// e.g. 'uid=someuser,cn=users,dc=somevalue'
LDAP_DEFAULTS = {
	url: false,
	port: '389',
	dn: false,
	createNewUser: false,
	defaultDomain: false,
	searchResultsProfileMap: false,
	base: null,
	search: '(objectclass=*)',
	ldapsCertificate: false
};

/**
 @class LDAP
 @constructor
 */
var LDAP = function(options) {
  // Set options
  this.options = _.defaults(options, LDAP_DEFAULTS);

  // Make sure options have been set
  try {
      check(this.options.url, String);
      //check(this.options.dn, String);
  } catch (e) {
      throw new Meteor.Error('Bad Defaults', 'Options not set. Make sure to set LDAP_DEFAULTS.url and LDAP_DEFAULTS.dn!');
  }

  // Because NPM ldapjs module has some binary builds,
  // We had to create a wraper package for it and build for
  // certain architectures. The package typ:ldap-js exports
  // 'MeteorWrapperLdapjs' which is a wrapper for the npm module
  this.ldapjs = MeteorWrapperLdapjs;
};

/**
 * Attempt to bind (authenticate) ldap
 * and perform a dn search if specified
 *
 * @method ldapCheck
 *
 * @param {Object} options  Object with username, ldapPass and overrides for LDAP_DEFAULTS object.
 * Additionally the searchBeforeBind parameter can be specified, which is used to search for the DN
 * if not provided.
 */
LDAP.prototype.ldapCheck = function(options) {

	var self = this;

	options = options || {};

	if (options.hasOwnProperty('username') && options.hasOwnProperty('ldapPass')
		&& options.username != '' && options.ldapPass != '') {

		var ldapAsyncFut = new Future();


		// Create ldap client
		var fullUrl = self.options.url + ':' + self.options.port;
		var client = null;

		if (self.options.url.indexOf('ldaps://') === 0) {
			client = self.ldapjs.createClient({
				url: fullUrl,
				tlsOptions: {
					ca: [ self.options.ldapsCertificate ]
				}
			});
		}
		else {
			client = self.ldapjs.createClient({
				url: fullUrl
			});
		}


		// Slide @xyz.whatever from username if it was passed in
		// and replace it with the domain specified in defaults
		var emailSliceIndex = options.username.indexOf('@');
		var username;
		var domain = self.options.defaultDomain;

		// If user appended email domain, strip it out
		// And use the defaults.defaultDomain if set
		if (emailSliceIndex !== -1) {
			username = options.username.substring(0, emailSliceIndex);
			domain = domain || options.username.substring((emailSliceIndex + 1), options.username.length);
		} else {
			username = options.username;
		}


		// If DN is provided, use it to bind
		if (self.options.dn) {
			// Attempt to bind to ldap server with provided info
			client.bind(self.options.dn, options.ldapPass, function(err) {

				try {
					if (err) {
						// Bind failure, return error
						throw new Meteor.Error(err.code, err.message);
					} else {
						// Bind auth successful
						// Create return object
						var retObject = {
							username: username,
							searchResults: null
						};

						// Return search results if specified
						if (self.options.searchResultsProfileMap) {

							// construct list of ldap attributes to fetch
							var attributes = [];
							self.options.searchResultsProfileMap.map(function(item) {
								attributes.push(item.resultKey);
							});

							// use base if given, else the dn for the ldap search
							var searchBase = self.options.base || self.options.dn;
							var searchOptions = {
								scope: 'sub',
								sizeLimit: 1,
								attributes: attributes,
								filter: self.options.search
							};

							client.search(searchBase, searchOptions, function(err, res) {

								res.on('searchEntry', function(entry) {
									// Add entry results to return object
									retObject.searchResults = entry.object;
									ldapAsyncFut.return(retObject);
								});

							});
						}
						// No search results specified, return username and email object
						else {
							ldapAsyncFut.return(retObject);
						}
					}
				} catch (e) {
					ldapAsyncFut.return({
						error: e
					});
				}
			});
		}
		// DN not provided, search for DN and use result to bind
		else if (typeof self.options.searchBeforeBind !== undefined) {
			// initialize result
			var retObject = {
				username: username,
				email: domain ? username + '@' + domain : false,
				emptySearch: true,
				searchResults: {}
			};

			// compile attribute list to return
			var searchAttributes = ['dn'];
			self.options.searchResultsProfileMap.map(function(item) {
				searchAttributes.push(item.resultKey);
			});


			var filter = self.options.search;
			Object.keys(options.ldapOptions.searchBeforeBind).forEach(function(searchKey) {
				filter = '&' + filter + '(' + searchKey + '=' + options.ldapOptions.searchBeforeBind[searchKey] + ')';
			});
			var searchOptions = {
				scope: 'sub',
				sizeLimit: 1,
				filter: filter
			};

			// perform LDAP search to determine DN
			client.search(self.options.base, searchOptions, function(err, res) {
				retObject.emptySearch = true;
				res.on('searchEntry', function(entry) {
					retObject.dn = entry.objectName;
					retObject.username = retObject.dn;
					retObject.emptySearch = false;

					// Return search results if specified
					if (self.options.searchResultsProfileMap) {
						// construct list of ldap attributes to fetch
						var attributes = [];
						self.options.searchResultsProfileMap.map(function (item) {
							retObject.searchResults[item.resultKey] = entry.object[item.resultKey];
						});
					}

					// use the determined DN to bind
					client.bind(entry.objectName, options.ldapPass, function(err) {
						try {
							if (err) {
								throw new Meteor.Error(err.code, err.message);
							}
							else {
								ldapAsyncFut.return(retObject);
							}
						}
						catch (e) {
							ldapAsyncFut.return({
								error: e
							});
						}
					});
				});
				// If no dn is found, return as is.
				res.on('end', function(result) {
					if (retObject.dn === undefined) {
						ldapAsyncFut.return(retObject);
					}
				});
			});
		}

		return ldapAsyncFut.wait();

	} else {
		throw new Meteor.Error(403, 'Missing LDAP Auth Parameter');
	}

};

/**
 * This package exports the ActiveDirectory object for use on the server.
 * Right now, "login" is the only function available.
 * "login" constructs an LDAP query using the provided username and password,
 * and the value specifid by LDAP_DEFAULTS.domain.
 * Active Directory can authenticate using username@domain, as opposed to
 * needing a full Distinguished Name (dn) like some LDAP systems.
 * This function also sets the LDAP "search" value to look for a sAMAccountName
 * matching the passed username. This effectively returns all information about
 * whichever username was authenticated.
 *
 * Example use:
 * LDAP_DEFAULTS.domain = "mycompany.com";
 * ActiveDirectory.login('myusername', 'mypass');
*/
ActiveDirectory = {
	login : function(username, password) {
		var loginRequest = {
	    username: username,
	    ldapPass: password,
	    ldap: true,
	    ldapOptions: {
	      dn: username + '@' + LDAP_DEFAULTS.domain,
	      search: '(sAMAccountName=' + username + ')'
			}
	  };

		// Instantiate LDAP with options
	  var userOptions = loginRequest.ldapOptions || {};
	  var ldapObj = new LDAP(userOptions);

	  // Call ldapCheck and get response
	  return ldapObj.ldapCheck(loginRequest);
	}
};
