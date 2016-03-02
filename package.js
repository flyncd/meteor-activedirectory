Package.describe({
  name: 'rmbrich:meteor-activedirectory',
  version: '1.0.1',
  summary: 'Meteor wrapper for logging into Active Directory NOT using Accounts',
  git: 'https://github.com/rmbrich/meteor-activedirectory.git',
  documentation: 'README.md'
});


Package.onUse(function(api) {
  api.versionsFrom('1.0.3.1');

  api.use(['templating'], 'client');
  api.use(['typ:ldapjs@0.7.3'], 'server');
  api.use('check');

  api.addFiles(['ldap_server.js'], 'server');

  api.export('LDAP_DEFAULTS', 'server');
  api.export('ActiveDirectory', 'server');
});
