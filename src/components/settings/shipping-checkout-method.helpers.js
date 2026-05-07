export function providerSelectionToLegacyUsage(activeRateProvider, labelProvider) {
  if (activeRateProvider !== "NONE" && labelProvider !== "NONE" && activeRateProvider === labelProvider) {
    return "LIVE_AND_LABELS";
  }
  if (activeRateProvider !== "NONE" && labelProvider === "NONE") {
    return "LIVE_RATES_ONLY";
  }
  if (activeRateProvider === "NONE" && labelProvider !== "NONE") {
    return "LABELS_ONLY";
  }
  return "LIVE_AND_LABELS";
}

export function buildCheckoutMethodDraft(mode, activeRateProvider, labelProvider, fallbackBehavior) {
  return {
    mode: mode || "MANUAL",
    activeRateProvider: activeRateProvider || "NONE",
    labelProvider: labelProvider || "NONE",
    fallbackBehavior: fallbackBehavior || "SHOW_FALLBACK",
  };
}

export function isCheckoutMethodEqual(left, right) {
  return (
    left?.mode === right?.mode &&
    left?.activeRateProvider === right?.activeRateProvider &&
    left?.labelProvider === right?.labelProvider &&
    left?.fallbackBehavior === right?.fallbackBehavior
  );
}

export function isCheckoutMethodDirty(left, right) {
  return !isCheckoutMethodEqual(left, right);
}

export function buildCheckoutMethodPatch(mode, activeRateProvider, labelProvider, fallbackBehavior) {
  const legacyUsage = providerSelectionToLegacyUsage(activeRateProvider, labelProvider);
  const legacyProvider =
    activeRateProvider !== "NONE"
      ? activeRateProvider
      : labelProvider !== "NONE"
        ? labelProvider
        : null;

  return {
    shippingMode: mode,
    activeRateProvider,
    labelProvider,
    fallbackBehavior,
    shippingLiveProvider: legacyProvider,
    shippingProviderUsage: legacyUsage,
  };
}
