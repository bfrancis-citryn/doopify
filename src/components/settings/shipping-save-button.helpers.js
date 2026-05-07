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
