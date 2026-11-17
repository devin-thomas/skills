// The names the example contract fixes (docs/TOOL-CONTRACT.md), in one place for
// the shell and the tests. Change them with the contract.
'use strict';

module.exports = {
  /** What a staging folder the tool makes beside its output is called. Nothing else is ever removed. */
  STAGING_NAME: /^\.example-[0-9a-f]{32}\.tmp$/,
  SCHEMA_EVENTS: 'example-events',
  SCHEMA_CAPABILITIES: 'example-capabilities',
  MAJOR: 1,
};
