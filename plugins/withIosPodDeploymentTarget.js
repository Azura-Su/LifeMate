const {
  withPodfile,
  withXcodeProject,
} = require('@expo/config-plugins');

const deploymentTarget = '15.1';

function withIosPodDeploymentTarget(config) {
  config = withPodfile(config, (mod) => {
    const podfile = mod.modResults;
    const marker = '# @generated begin lifemate-ios-deployment-target-v3';

    podfile.contents = podfile.contents.replace(
      'bash -l -c "$PODS_TARGET_SRCROOT/../scripts/get-app-config-ios.sh"',
      'bash "$PODS_TARGET_SRCROOT/../scripts/get-app-config-ios.sh"',
    );
    if (podfile.contents.includes(marker)) return mod;

    const block = `\n    ${marker}\n    installer.pods_project.targets.each do |target|\n      target.build_configurations.each do |build_config|\n        build_config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '${deploymentTarget}'\n      end\n      target.shell_script_build_phases.each do |phase|\n        phase.shell_script = phase.shell_script.gsub('bash -l -c', 'bash')\n      end\n    end\n    # @generated end lifemate-ios-deployment-target-v3\n`;

    podfile.contents = podfile.contents.replace(
      /(\n  post_install do \|installer\|[\s\S]*?)(\n  end\nend\n?)$/,
      (_existing, hook, closing) => `${hook}${block}${closing}`,
    );
    return mod;
  });

  return withXcodeProject(config, (mod) => {
    const project = mod.modResults;
    const phases = project.hash.project.objects.PBXShellScriptBuildPhase;
    const phase = Object.values(phases).find(
      (candidate) =>
        candidate &&
        typeof candidate === 'object' &&
        candidate.name === '"Bundle React Native code and images"' &&
        typeof candidate.shellScript === 'string' &&
        candidate.shellScript.includes('react-native-xcode.sh'),
    );
    if (!phase?.shellScript) return mod;

    const scriptIndex = phase.shellScript.indexOf('react-native-xcode.sh');
    const start = phase.shellScript.lastIndexOf('`', scriptIndex);
    if (start < 0) return mod;
    const end = phase.shellScript.indexOf('`', scriptIndex);
    if (end < 0) return mod;
    const replacement = String.raw`bash \"$(\"$NODE_BINARY\" --print \"require('path').dirname(require.resolve('react-native/package.json')) + '/scripts/react-native-xcode.sh'\")\"`;
    phase.shellScript = `${phase.shellScript.slice(0, start)}${replacement}${phase.shellScript.slice(end + 1)}`;
    return mod;
  });
}

module.exports = withIosPodDeploymentTarget;
