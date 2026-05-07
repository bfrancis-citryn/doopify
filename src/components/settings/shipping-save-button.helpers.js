export function getShippingHeaderSaveButtonState({
  loading = false,
  hasError = false,
  shippingConfigLoading = false,
  hasSaveAction = false,
  shippingModeSavedState = "saved",
  shippingModeDirty = false,
} = {}) {
  const isSaving = shippingModeSavedState === "saving";
  const disabled =
    loading || hasError || shippingConfigLoading || !hasSaveAction || isSaving || !shippingModeDirty;

  return {
    disabled,
    label: isSaving ? "Saving..." : "Save changes",
  };
}

export function resolveShippingSaveActionRegistration(action) {
  const saveAction = typeof action === "function" ? action : null;
  return {
    saveAction,
    saveActionReady: Boolean(saveAction),
  };
}

export function invokeShippingSaveAction(action) {
  if (typeof action !== "function") return undefined;
  return action();
}
