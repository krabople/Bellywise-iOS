const { withEntitlementsPlist } = require('@expo/config-plugins');

/**
 * Bellywise schedules notifications entirely on the device. Expo Notifications'
 * automatic config plugin adds Apple's remote-push entitlement even when an app
 * never obtains a push token, so remove that entitlement after Expo applies its
 * default plugins. The native notifications module remains linked and local
 * notification scheduling continues to work.
 */
module.exports = function withLocalNotificationsOnly(config) {
  return withEntitlementsPlist(config, (updatedConfig) => {
    delete updatedConfig.modResults['aps-environment'];
    return updatedConfig;
  });
};
