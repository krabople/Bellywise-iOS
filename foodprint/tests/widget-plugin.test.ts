import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const xcode = require('xcode');
const { addWidgetTarget } = require('../plugins/with-quick-log-widget');

test('widget target is embedded, independently configured and safe to regenerate', () => {
  const project = xcode.project('fixture');
  const root = 'A00000000000000000000001', group = 'A00000000000000000000002', app = 'A00000000000000000000003';
  project.hash = { project: { rootObject: root, objects: {
    PBXProject: { [root]: { isa: 'PBXProject', mainGroup: group, targets: [{ value: app, comment: 'Bellywise' }] } },
    PBXGroup: { [group]: { isa: 'PBXGroup', children: [], sourceTree: '"<group>"' } },
    PBXNativeTarget: { [app]: { isa: 'PBXNativeTarget', name: 'Bellywise', productType: '"com.apple.product-type.application"', buildPhases: [], dependencies: [] } },
    PBXFileReference: {}, PBXBuildFile: {}, XCBuildConfiguration: {}, XCConfigurationList: {},
    PBXSourcesBuildPhase: {}, PBXFrameworksBuildPhase: {}, PBXResourcesBuildPhase: {}, PBXCopyFilesBuildPhase: {}, PBXTargetDependency: {}, PBXContainerItemProxy: {},
  } } };
  const config = { version: '1.0.0', ios: { bundleIdentifier: 'com.krabople.bellywise', appleTeamId: '6YYA8L76Y8', buildNumber: '25' } };
  addWidgetTarget(project, config);
  const output = project.writeSync();
  assert.match(output, /com\.krabople\.bellywise\.quicklog/);
  assert.match(output, /BellywiseQuickLog.swift in Sources/);
  assert.match(output, /dstSubfolderSpec = 13/); // PlugIns destination
  assert.match(output, /CURRENT_PROJECT_VERSION = 25/);
  assert.doesNotMatch(output, /undefined/);
  const main = project.pbxNativeTargetSection()[app];
  assert.equal(main.dependencies.length, 1);
  assert.equal(main.buildPhases.length, 1); // Embed extension
  assert.equal(Object.values(project.pbxXCBuildConfigurationSection()).filter((value: any) => typeof value === 'object').length, 2);
  addWidgetTarget(project, config);
  assert.equal(project.writeSync(), output);
});
