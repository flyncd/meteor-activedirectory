Meteor Package meteor-activedirectory
============================

This package borrows heavily from [typ's meteor-accounts-ldap](https://github.com/typ90/meteor-accounts-ldap), including this Readme. The package provides a function for authenticating a user against Active Directory, but purposely does NOT rely on Meteor's Accounts system. It simply returns authentication success, errors, and search results (if applicable).

This package was created for a use case in which Mongo - and therefore Meteor Accounts - is not available.


Installation
------------

You can add this package through Atmosphere by typing:

`meteor add rmbrich:meteor-activedirectory` from the command line.

**OR if you'd like to customize it a bit:**

Clone this repo and copy it to `/packages` in your Meteor project.


Usage
-----

#### Server Side Configuration
The package exposes a global variable called `LDAP_DEFAULTS` on the server side. Set these options somewhere before the execution of your server-side code.

`LDAP_DEFAULTS.url`: Address of your your Active Directory domain controller.
E.g. `ldap://IMADC.your.company.com`

`LDAP_DEFAULTS.port`: LDAP connection port. Defaults to 389 if not set.

`LDAP_DEFAULTS.base`: The base search string to use for Active Directory lookups. Should match your Active Directory domain controller's domain.
E.g.: if your domain controller is `IMADC.your.company.com`, set this to `DC=your,DC=company,DC=com`.

`LDAP_DEFAULTS.domain`: Active Directory can authenticate using **username@domain**, as opposed to needing a full Distinguished Name (dn) like some LDAP systems. Set the **domain** portion here.
E.g.: if your domain is `your.company.com`, set this to `your.company.com`.

`LDAP_DEFAULTS.searchResultsProfileMap`: This can be used if there are attributes of the user you'd like to return in the results object.

For example, if the results had a 'cn' value of the user's name and a 'tn' value of their phone number, you'd set the `searchResultsProfileMap` to this:

```
LDAP_DEFAULTS.searchResultsProfileMap = [{
  resultKey: 'cn',
  profileProperty: 'cn'
}, {
  resultKey: 'tn',
  profileProperty: 'tn'
}],
```

#### LDAPS Support

If you want to use `ldaps` to implement secure authentication, you also need to provide an SSL certificate
(e.g. in the shape of a `ssl.pem` file)

Simply set the following defaults in some server-side code:

```
LDAP_DEFAULTS.ldapsCertificate = Assets.getText('ldaps/ssl.pem'); // asset location of the SSL certificate
LDAP_DEFAULTS.port = 636; // default port for LDAPS
LDAP_DEFAULTS.url = 'ldaps://my-ldap-host.com'; // ldaps protocol
```

This example configuration will require the `ssl.pem` file to be located in `<your-project-root>/private/ldap/ssl.pem`.

#### Client Side Usage

This is a server-side package. Create a server-side Method and call it from the client, passing username and password.

#### Server Side Usage

Here's an example of calling the package from a Meteor Method:

```
LDAP_DEFAULTS.url = 'ldap://IMADC.your.company.com';
LDAP_DEFAULTS.base = 'DC=your,DC=company,DC=com';
LDAP_DEFAULTS.domain = 'company.com';
LDAP_DEFAULTS.searchResultsProfileMap = [{
  resultKey: 'displayName',
  profileProperty: 'displayName',
},
{
  resultKey: 'department',
  profileProperty: 'department'
}];

Meteor.methods({
  loginWithAD: function(username, password) {

    var ldapResponse = ActiveDirectory.login(username, password);
    console.log(ldapResponse);
  }
});
```

When called, ldapResponse will look something like this:

```
{
  username: 'myuser',
  searchResults: {
    dn: 'CN=My User,OU=Employees,OU=My Company,DC=your,DC=company,DC=com',
    controls: [],
    displayName: 'My User',
    department: 'Best Dept. Ever'
  }
}
```
