export function isSettingsTabLoadingState({
  activeSection = "general",
  loading = false,
  hasError = false,
  brandKitLoading = false,
  brandKitLoaded = false,
  shippingConfigLoading = false,
  shippingConfigLoaded = false,
  providerStatusLoading = false,
  providerStatusLoaded = false,
  paymentActivityLoading = false,
  paymentActivityLoaded = false,
  emailActivityLoading = false,
  emailActivityLoaded = false,
  setupLoading = false,
  setupLoaded = false,
  readinessLoading = false,
  readinessLoaded = false,
  deploymentLoading = false,
  deploymentLoaded = false,
  wizardLoading = false,
  wizardLoaded = false,
  sessionUser = null,
} = {}) {
  if (hasError) return false;
  if (loading) return true;

  if (activeSection === "setup") {
    return (
      (setupLoading && !setupLoaded) ||
      (readinessLoading && !readinessLoaded) ||
      (deploymentLoading && !deploymentLoaded) ||
      (wizardLoading && !wizardLoaded)
    );
  }

  if (activeSection === "account") {
    return !sessionUser;
  }

  return false;
}
