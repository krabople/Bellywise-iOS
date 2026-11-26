const { withXcodeProject, withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');
const targetName = 'BellywiseQuickLog';

function addWidgetTarget(project, config) {
  if (Object.values(project.pbxNativeTargetSection()).some(target => typeof target === 'object' && target.name?.replaceAll('"', '') === targetName)) return project;
  const target = project.addTarget(targetName, 'app_extension', targetName, `${config.ios.bundleIdentifier}.quicklog`);
  project.addBuildPhase([], 'PBXSourcesBuildPhase', 'Sources', target.uuid);
  project.addBuildPhase([], 'PBXFrameworksBuildPhase', 'Frameworks', target.uuid);
  project.addBuildPhase([], 'PBXResourcesBuildPhase', 'Resources', target.uuid);
  const group = project.addPbxGroup([], targetName, targetName);
  project.addToPbxGroup(group.uuid, project.getFirstProject().firstProject.mainGroup);
  const source = project.addSourceFile('BellywiseQuickLog.swift', { target: target.uuid }, group.uuid);
  delete project.pbxFileReferenceSection()[source.fileRef].explicitFileType;
  // node-xcode's resource helper inspects this group even when another group
  // is supplied. A freshly generated Expo project need not contain it yet.
  if ((config.ios.infoPlist?.CFBundleLocalizations || []).length && !project.pbxGroupByName('Resources')) {
    const resources = project.addPbxGroup([], 'Resources');
    project.addToPbxGroup(resources.uuid, project.getFirstProject().firstProject.mainGroup);
  }
  for (const locale of config.ios.infoPlist?.CFBundleLocalizations || []) {
    const resource = project.addResourceFile(`${locale}.lproj`, { target: target.uuid }, group.uuid);
    if (resource?.fileRef) project.pbxFileReferenceSection()[resource.fileRef].lastKnownFileType = 'folder';
  }
  for (const file of Object.values(project.pbxBuildFileSection())) {
    if (typeof file === 'object' && file.fileRef === target.pbxNativeTarget.productReference) file.settings = { ATTRIBUTES: ['RemoveHeadersOnCopy'] };
  }
  const configurationList = project.pbxXCConfigurationList()[target.pbxNativeTarget.buildConfigurationList];
  for (const ref of configurationList.buildConfigurations) {
    const settings = project.pbxXCBuildConfigurationSection()[ref.value].buildSettings;
    Object.assign(settings, {
      SWIFT_VERSION: '5.0', IPHONEOS_DEPLOYMENT_TARGET: '16.4',
      TARGETED_DEVICE_FAMILY: '"1,2"', SDKROOT: 'iphoneos',
      APPLICATION_EXTENSION_API_ONLY: 'YES', CODE_SIGN_STYLE: 'Automatic',
      DEVELOPMENT_TEAM: config.ios.appleTeamId || '',
      CURRENT_PROJECT_VERSION: config.ios.buildNumber || '1',
      MARKETING_VERSION: config.version || '1.0.0',
      GENERATE_INFOPLIST_FILE: 'NO',
    });
  }
  // node-xcode leaves optional file/group fields explicitly undefined. Omit
  // them so the generated plist has no invalid literal "undefined" values.
  for (const section of [project.pbxFileReferenceSection(), project.hash.project.objects.PBXGroup]) {
    for (const entry of Object.values(section)) {
      if (typeof entry !== 'object') continue;
      for (const key of Object.keys(entry)) if (entry[key] === undefined) delete entry[key];
    }
  }
  return project;
}

function withQuickLogWidget(config) {
  config = withDangerousMod(config, ['ios', async mod => {
    const folder = path.join(mod.modRequest.platformProjectRoot, targetName);
    fs.mkdirSync(folder, { recursive: true });
    fs.copyFileSync(path.join(mod.modRequest.projectRoot, 'native', targetName, `${targetName}.swift`), path.join(folder, `${targetName}.swift`));
    for (const entry of fs.readdirSync(path.join(mod.modRequest.projectRoot, 'native', targetName))) {
      if (entry.endsWith('.lproj')) fs.cpSync(path.join(mod.modRequest.projectRoot, 'native', targetName, entry), path.join(folder, entry), { recursive: true });
    }
    fs.writeFileSync(path.join(folder, `${targetName}-Info.plist`), `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>CFBundleDisplayName</key><string>Bellywise quick log</string>
<key>CFBundleIdentifier</key><string>$(PRODUCT_BUNDLE_IDENTIFIER)</string>
<key>CFBundleExecutable</key><string>$(EXECUTABLE_NAME)</string>
<key>CFBundleName</key><string>$(PRODUCT_NAME)</string>
<key>CFBundlePackageType</key><string>XPC!</string>
<key>CFBundleShortVersionString</key><string>$(MARKETING_VERSION)</string>
<key>CFBundleVersion</key><string>$(CURRENT_PROJECT_VERSION)</string>
<key>CFBundleDevelopmentRegion</key><string>en-GB</string>
<key>CFBundleLocalizations</key><array>${(mod.ios.infoPlist?.CFBundleLocalizations || ['en-GB']).map(locale => `<string>${locale}</string>`).join('')}</array>
<key>NSExtension</key><dict><key>NSExtensionPointIdentifier</key><string>com.apple.widgetkit-extension</string></dict>
</dict></plist>`);
    return mod;
  }]);
  return withXcodeProject(config, mod => { addWidgetTarget(mod.modResults, mod); return mod; });
}
module.exports = withQuickLogWidget;
module.exports.addWidgetTarget = addWidgetTarget;
