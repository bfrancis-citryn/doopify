"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import AppShell from "../AppShell";
import AdminButton from "../admin/ui/AdminButton";
import AdminCard from "../admin/ui/AdminCard";
import AdminDrawer from "../admin/ui/AdminDrawer";
import AdminEmptyState from "../admin/ui/AdminEmptyState";
import AdminField from "../admin/ui/AdminField";
import AdminInput from "../admin/ui/AdminInput";
import AdminSelect from "../admin/ui/AdminSelect";
import AdminStatusChip from "../admin/ui/AdminStatusChip";
import styles from "./SettingsWorkspace.module.css";

const DEFAULT_PACKAGE_FORM = {
  id: "",
  name: "",
  type: "BOX",
  length: "",
  width: "",
  height: "",
  dimensionUnit: "IN",
  emptyPackageWeight: "",
  weightUnit: "OZ",
  isDefault: true,
  isActive: true,
};

const DEFAULT_LOCATION_FORM = {
  id: "",
  name: "",
  contactName: "",
  company: "",
  address1: "",
  address2: "",
  city: "",
  stateProvince: "",
  postalCode: "",
  country: "US",
  phone: "",
  isDefault: true,
  isActive: true,
};

const DEFAULT_MANUAL_RATE_FORM = {
  id: "",
  name: "",
  regionCountry: "US",
  regionStateProvince: "",
  rateType: "FLAT",
  amount: "",
  minWeight: "",
  maxWeight: "",
  minSubtotal: "",
  maxSubtotal: "",
  freeOverAmount: "",
  estimatedDeliveryText: "",
  isActive: true,
};

const DEFAULT_FALLBACK_RATE_FORM = {
  id: "",
  name: "",
  regionCountry: "US",
  regionStateProvince: "",
  amount: "",
  estimatedDeliveryText: "",
  isActive: true,
};

function parseNumber(value) {
  if (value == null || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizeOptional(value) {
  const normalized = String(value || "").trim();
  return normalized || null;
}

function normalizeCountry(value) {
  return String(value || "").trim().toUpperCase();
}

async function parseApiJson(response) {
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.success) {
    throw new Error(payload?.error || "Request failed");
  }
  return payload.data;
}

function formatMoney(amount, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(Number(amount || 0));
}

function formatPackageLine(item) {
  return `${item.length}x${item.width}x${item.height} ${item.dimensionUnit} | ${item.emptyPackageWeight} ${item.weightUnit}`;
}

function formatLocationLine(item) {
  return `${item.address1}, ${item.city}, ${item.stateProvince || ""} ${item.postalCode}, ${item.country}`.replace(/\s+,/g, ",").trim();
}

function renderRateSummary(rate, currency) {
  if (rate.rateType === "FREE") return "Free";
  return formatMoney(rate.amount, currency);
}

export default function ShippingSettingsWorkspace() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [settings, setSettings] = useState(null);
  const [setupStatus, setSetupStatus] = useState(null);
  const [mode, setMode] = useState("MANUAL");
  const [provider, setProvider] = useState("");
  const [providerUsage, setProviderUsage] = useState("LIVE_AND_LABELS");

  const [providerDrawerOpen, setProviderDrawerOpen] = useState(false);
  const [providerToken, setProviderToken] = useState("");
  const [providerTestMessage, setProviderTestMessage] = useState("");

  const [packageDrawerOpen, setPackageDrawerOpen] = useState(false);
  const [locationDrawerOpen, setLocationDrawerOpen] = useState(false);
  const [manualDrawerOpen, setManualDrawerOpen] = useState(false);
  const [fallbackDrawerOpen, setFallbackDrawerOpen] = useState(false);

  const [packageForm, setPackageForm] = useState(DEFAULT_PACKAGE_FORM);
  const [locationForm, setLocationForm] = useState(DEFAULT_LOCATION_FORM);
  const [manualForm, setManualForm] = useState(DEFAULT_MANUAL_RATE_FORM);
  const [fallbackForm, setFallbackForm] = useState(DEFAULT_FALLBACK_RATE_FORM);
  const [locationValidationMessage, setLocationValidationMessage] = useState("");

  const packages = settings?.shippingPackages || [];
  const locations = settings?.shippingLocations || [];
  const manualRates = settings?.shippingManualRates || [];
  const fallbackRates = settings?.shippingFallbackRates || [];
  const currency = settings?.currency || "USD";

  const hasDefaultPackage = useMemo(
    () => packages.some((entry) => entry.isDefault && entry.isActive),
    [packages]
  );

  const hasDefaultLocation = useMemo(
    () => locations.some((entry) => entry.isDefault && entry.isActive),
    [locations]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [shipping, setup] = await Promise.all([
        fetch("/api/settings/shipping", { cache: "no-store" }).then(parseApiJson),
        fetch("/api/settings/shipping/setup-status", { cache: "no-store" }).then(parseApiJson),
      ]);
      setSettings(shipping);
      setSetupStatus(setup);
      setMode(shipping.shippingMode || "MANUAL");
      setProvider(shipping.shippingLiveProvider || "");
      setProviderUsage(shipping.shippingProviderUsage || "LIVE_AND_LABELS");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load shipping settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function persistSettings(patch, message) {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await fetch("/api/settings/shipping", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      }).then(parseApiJson);
      setNotice(message || "Saved.");
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save shipping settings");
    } finally {
      setSaving(false);
    }
  }

  async function saveMode() {
    await persistSettings(
      {
        shippingMode: mode,
        shippingLiveProvider: provider || null,
        shippingProviderUsage: providerUsage,
      },
      "Shipping mode saved."
    );
  }

  async function saveProviderToken() {
    if (!provider || !providerToken.trim()) {
      setError("Select a provider and enter an API token.");
      return;
    }

    setSaving(true);
    setError("");
    setNotice("");
    try {
      await fetch("/api/settings/shipping/connect-provider", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, apiKey: providerToken.trim() }),
      }).then(parseApiJson);

      await fetch("/api/settings/shipping", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shippingLiveProvider: provider,
          shippingProviderUsage: providerUsage,
        }),
      }).then(parseApiJson);

      setProviderToken("");
      setProviderTestMessage("");
      setNotice("Provider credentials saved.");
      await load();
    } catch (providerError) {
      setError(providerError instanceof Error ? providerError.message : "Failed to save provider token");
    } finally {
      setSaving(false);
    }
  }

  async function testProvider() {
    if (!provider) {
      setError("Select a provider before testing connection.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const data = await fetch("/api/settings/shipping/test-provider", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider }),
      }).then(parseApiJson);

      setProviderTestMessage(data?.result?.message || "Provider verification completed.");
      await load();
    } catch (providerError) {
      setError(providerError instanceof Error ? providerError.message : "Failed to test provider");
    } finally {
      setSaving(false);
    }
  }

  async function persistEntity(url, method, payload, successMessage = "Saved.") {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: payload ? JSON.stringify(payload) : undefined,
      }).then(parseApiJson);
      setNotice(successMessage);
      await load();
    } catch (persistError) {
      setError(persistError instanceof Error ? persistError.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function validateLocationAddress() {
    setSaving(true);
    setError("");
    setLocationValidationMessage("");

    try {
      const data = await fetch("/api/settings/shipping/locations/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address1: locationForm.address1,
          city: locationForm.city,
          stateProvince: normalizeOptional(locationForm.stateProvince),
          postalCode: locationForm.postalCode,
          country: normalizeCountry(locationForm.country),
        }),
      }).then(parseApiJson);

      setLocationValidationMessage(data?.message || "Validation complete.");
    } catch (validationError) {
      setError(validationError instanceof Error ? validationError.message : "Address validation failed");
    } finally {
      setSaving(false);
    }
  }

  function openPackageDrawer(entry) {
    if (!entry) {
      setPackageForm({ ...DEFAULT_PACKAGE_FORM });
      setPackageDrawerOpen(true);
      return;
    }

    setPackageForm({
      id: entry.id,
      name: entry.name || "",
      type: entry.type || "BOX",
      length: String(entry.length ?? ""),
      width: String(entry.width ?? ""),
      height: String(entry.height ?? ""),
      dimensionUnit: entry.dimensionUnit || "IN",
      emptyPackageWeight: String(entry.emptyPackageWeight ?? ""),
      weightUnit: entry.weightUnit || "OZ",
      isDefault: Boolean(entry.isDefault),
      isActive: Boolean(entry.isActive),
    });
    setPackageDrawerOpen(true);
  }

  function openLocationDrawer(entry) {
    setLocationValidationMessage("");

    if (!entry) {
      setLocationForm({ ...DEFAULT_LOCATION_FORM });
      setLocationDrawerOpen(true);
      return;
    }

    setLocationForm({
      id: entry.id,
      name: entry.name || "",
      contactName: entry.contactName || "",
      company: entry.company || "",
      address1: entry.address1 || "",
      address2: entry.address2 || "",
      city: entry.city || "",
      stateProvince: entry.stateProvince || "",
      postalCode: entry.postalCode || "",
      country: entry.country || "US",
      phone: entry.phone || "",
      isDefault: Boolean(entry.isDefault),
      isActive: Boolean(entry.isActive),
    });
    setLocationDrawerOpen(true);
  }

  function openManualRateDrawer(entry) {
    if (!entry) {
      setManualForm({ ...DEFAULT_MANUAL_RATE_FORM });
      setManualDrawerOpen(true);
      return;
    }

    setManualForm({
      id: entry.id,
      name: entry.name || "",
      regionCountry: entry.regionCountry || "",
      regionStateProvince: entry.regionStateProvince || "",
      rateType: entry.rateType || "FLAT",
      amount: String(entry.amount ?? ""),
      minWeight: entry.minWeight == null ? "" : String(entry.minWeight),
      maxWeight: entry.maxWeight == null ? "" : String(entry.maxWeight),
      minSubtotal: entry.minSubtotal == null ? "" : String(entry.minSubtotal),
      maxSubtotal: entry.maxSubtotal == null ? "" : String(entry.maxSubtotal),
      freeOverAmount: entry.freeOverAmount == null ? "" : String(entry.freeOverAmount),
      estimatedDeliveryText: entry.estimatedDeliveryText || "",
      isActive: Boolean(entry.isActive),
    });
    setManualDrawerOpen(true);
  }

  function openFallbackRateDrawer(entry) {
    if (!entry) {
      setFallbackForm({ ...DEFAULT_FALLBACK_RATE_FORM });
      setFallbackDrawerOpen(true);
      return;
    }

    setFallbackForm({
      id: entry.id,
      name: entry.name || "",
      regionCountry: entry.regionCountry || "",
      regionStateProvince: entry.regionStateProvince || "",
      amount: String(entry.amount ?? ""),
      estimatedDeliveryText: entry.estimatedDeliveryText || "",
      isActive: Boolean(entry.isActive),
    });
    setFallbackDrawerOpen(true);
  }

  async function savePackage() {
    await persistEntity(
      packageForm.id ? `/api/settings/shipping/packages/${packageForm.id}` : "/api/settings/shipping/packages",
      packageForm.id ? "PATCH" : "POST",
      {
        name: packageForm.name.trim(),
        type: packageForm.type,
        length: parseNumber(packageForm.length),
        width: parseNumber(packageForm.width),
        height: parseNumber(packageForm.height),
        dimensionUnit: packageForm.dimensionUnit,
        emptyPackageWeight: parseNumber(packageForm.emptyPackageWeight),
        weightUnit: packageForm.weightUnit,
        isDefault: Boolean(packageForm.isDefault),
        isActive: Boolean(packageForm.isActive),
      },
      packageForm.id ? "Package updated." : "Package added."
    );
    setPackageDrawerOpen(false);
  }

  async function saveLocation() {
    await persistEntity(
      locationForm.id ? `/api/settings/shipping/locations/${locationForm.id}` : "/api/settings/shipping/locations",
      locationForm.id ? "PATCH" : "POST",
      {
        name: locationForm.name.trim(),
        contactName: normalizeOptional(locationForm.contactName),
        company: normalizeOptional(locationForm.company),
        address1: locationForm.address1.trim(),
        address2: normalizeOptional(locationForm.address2),
        city: locationForm.city.trim(),
        stateProvince: normalizeOptional(locationForm.stateProvince),
        postalCode: locationForm.postalCode.trim(),
        country: normalizeCountry(locationForm.country),
        phone: normalizeOptional(locationForm.phone),
        isDefault: Boolean(locationForm.isDefault),
        isActive: Boolean(locationForm.isActive),
      },
      locationForm.id ? "Ship-from location updated." : "Ship-from location added."
    );
    setLocationDrawerOpen(false);
  }

  async function saveManualRate() {
    await persistEntity(
      manualForm.id ? `/api/settings/shipping/manual-rates/${manualForm.id}` : "/api/settings/shipping/manual-rates",
      manualForm.id ? "PATCH" : "POST",
      {
        name: manualForm.name.trim(),
        regionCountry: normalizeOptional(manualForm.regionCountry)?.toUpperCase() || null,
        regionStateProvince: normalizeOptional(manualForm.regionStateProvince),
        rateType: manualForm.rateType,
        amount: parseNumber(manualForm.amount),
        minWeight: parseNumber(manualForm.minWeight),
        maxWeight: parseNumber(manualForm.maxWeight),
        minSubtotal: parseNumber(manualForm.minSubtotal),
        maxSubtotal: parseNumber(manualForm.maxSubtotal),
        freeOverAmount: parseNumber(manualForm.freeOverAmount),
        estimatedDeliveryText: normalizeOptional(manualForm.estimatedDeliveryText),
        isActive: Boolean(manualForm.isActive),
      },
      manualForm.id ? "Manual rate updated." : "Manual rate added."
    );
    setManualDrawerOpen(false);
  }

  async function saveFallbackRate() {
    await persistEntity(
      fallbackForm.id
        ? `/api/settings/shipping/fallback-rates/${fallbackForm.id}`
        : "/api/settings/shipping/fallback-rates",
      fallbackForm.id ? "PATCH" : "POST",
      {
        name: fallbackForm.name.trim(),
        regionCountry: normalizeOptional(fallbackForm.regionCountry)?.toUpperCase() || null,
        regionStateProvince: normalizeOptional(fallbackForm.regionStateProvince),
        amount: parseNumber(fallbackForm.amount),
        estimatedDeliveryText: normalizeOptional(fallbackForm.estimatedDeliveryText),
        isActive: Boolean(fallbackForm.isActive),
      },
      fallbackForm.id ? "Fallback rate updated." : "Fallback rate added."
    );
    setFallbackDrawerOpen(false);
  }

  return (
    <AppShell>
      <div className={styles.pageWrap}>
        <div className={styles.pageHeader}>
          <div>
            <h2>Shipping & delivery</h2>
            <p>Checkout rates decide what customers pay. Label providers buy postage after order placement.</p>
          </div>
          <AdminButton onClick={load} size="sm" variant="secondary">
            Refresh
          </AdminButton>
        </div>

        {loading ? <p className={styles.statusText}>Loading...</p> : null}
        {error ? <div className={styles.statusBlock}><p className={styles.statusText}>{error}</p></div> : null}
        {notice ? <div className={styles.statusBlock}><p className={styles.statusText}>{notice}</p></div> : null}

        {!loading ? (
          <div className={styles.configStack}>
            <section className={styles.configSection}>
              <div className={styles.sectionHeading}><h3>Checkout rate method</h3></div>
              <div className={styles.formGrid}>
                <label className={styles.field}>
                  <span>Shipping mode</span>
                  <AdminSelect
                    value={mode}
                    onChange={setMode}
                    options={[
                      { value: "LIVE_RATES", label: "Live rates" },
                      { value: "MANUAL", label: "Manual only" },
                      { value: "HYBRID", label: "Hybrid" },
                    ]}
                  />
                </label>
              </div>
              <p className={styles.statusText}>
                LIVE_RATES tries provider quotes first. MANUAL uses manual rates only. HYBRID combines live rates with manual/fallback paths.
              </p>
              <div className={styles.actionRow}>
                <AdminButton disabled={saving} onClick={saveMode} size="sm" variant="secondary">
                  {saving ? "Saving..." : "Save mode"}
                </AdminButton>
              </div>
            </section>

            <section className={styles.configSection}>
              <div className={styles.sectionHeading}><h3>Live rate and label provider</h3></div>
              <div className={styles.actionRow}>
                <AdminStatusChip tone={setupStatus?.providerConnected ? "success" : "warning"}>
                  {setupStatus?.providerConnected ? "Connected" : "Not connected"}
                </AdminStatusChip>
                <p className={styles.statusText}>Provider: {provider || "None selected"}</p>
              </div>
              <div className={styles.actionRow}>
                <AdminButton onClick={() => setProviderDrawerOpen(true)} size="sm" variant="secondary">
                  Manage provider
                </AdminButton>
              </div>
            </section>

            <section className={styles.configSection}>
              <div className={styles.sectionHeading}><h3>Live-rate requirements</h3></div>
              <div className={styles.actionRow}>
                <AdminStatusChip tone={hasDefaultLocation ? "success" : "warning"}>
                  {hasDefaultLocation ? "Ship-from location ready" : "Ship-from location missing"}
                </AdminStatusChip>
                <AdminStatusChip tone={hasDefaultPackage ? "success" : "warning"}>
                  {hasDefaultPackage ? "Default package ready" : "Default package missing"}
                </AdminStatusChip>
              </div>
              {setupStatus?.warnings?.length ? (
                <ul className={styles.setupList}>
                  {setupStatus.warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              ) : (
                <p className={styles.statusText}>No setup warnings.</p>
              )}

              <div className={styles.divider} />
              <div className={styles.sectionHeading}><h3>Ship-from locations</h3></div>
              {locations.length ? (
                locations.map((entry) => (
                  <div className={styles.configRow} key={entry.id}>
                    <p className={styles.statusText}>
                      <strong>{entry.name}</strong> | {formatLocationLine(entry)}
                    </p>
                    <div className={styles.actionRow}>
                      {entry.isDefault ? <AdminStatusChip tone="success">Default</AdminStatusChip> : null}
                      {!entry.isActive ? <AdminStatusChip tone="warning">Inactive</AdminStatusChip> : null}
                      <AdminButton onClick={() => openLocationDrawer(entry)} size="sm" variant="secondary">Edit</AdminButton>
                      <AdminButton onClick={() => persistEntity(`/api/settings/shipping/locations/${entry.id}`, "DELETE", undefined, "Ship-from location removed.")} size="sm" variant="danger">Delete</AdminButton>
                    </div>
                  </div>
                ))
              ) : (
                <AdminEmptyState
                  title="No ship-from locations"
                  description="Add a default ship-from location for live rates, labels, return labels, and packing slips."
                  icon="warehouse"
                />
              )}
              <div className={styles.actionRow}>
                <AdminButton onClick={() => openLocationDrawer(null)} size="sm" variant="secondary">
                  Add ship-from location
                </AdminButton>
              </div>
            </section>

            <section className={styles.configSection}>
              <div className={styles.sectionHeading}><h3>Packages</h3></div>
              {packages.length ? (
                packages.map((entry) => (
                  <div className={styles.configRow} key={entry.id}>
                    <p className={styles.statusText}>
                      <strong>{entry.name}</strong> | {formatPackageLine(entry)}
                    </p>
                    <div className={styles.actionRow}>
                      {entry.isDefault ? <AdminStatusChip tone="success">Default</AdminStatusChip> : null}
                      {!entry.isActive ? <AdminStatusChip tone="warning">Inactive</AdminStatusChip> : null}
                      <AdminButton onClick={() => openPackageDrawer(entry)} size="sm" variant="secondary">Edit</AdminButton>
                      <AdminButton onClick={() => persistEntity(`/api/settings/shipping/packages/${entry.id}`, "DELETE", undefined, "Package removed.")} size="sm" variant="danger">Delete</AdminButton>
                    </div>
                  </div>
                ))
              ) : (
                <AdminEmptyState
                  title="No packages"
                  description="Add a default package so live rates and label buying can estimate shipping correctly."
                  icon="inventory_2"
                />
              )}
              <div className={styles.actionRow}>
                <AdminButton onClick={() => openPackageDrawer(null)} size="sm" variant="secondary">
                  Add package
                </AdminButton>
              </div>
            </section>

            <section className={styles.configSection}>
              <div className={styles.sectionHeading}><h3>Manual checkout rates</h3></div>
              <p className={styles.statusText}>Manual rates control what customers pay. They do not buy postage.</p>
              {manualRates.length ? (
                manualRates.map((rate) => (
                  <div className={styles.configRow} key={rate.id}>
                    <p className={styles.statusText}>
                      <strong>{rate.name}</strong> | {rate.rateType} | {renderRateSummary(rate, currency)}
                    </p>
                    <div className={styles.actionRow}>
                      {!rate.isActive ? <AdminStatusChip tone="warning">Inactive</AdminStatusChip> : null}
                      <AdminButton onClick={() => openManualRateDrawer(rate)} size="sm" variant="secondary">Edit</AdminButton>
                      <AdminButton onClick={() => persistEntity(`/api/settings/shipping/manual-rates/${rate.id}`, "DELETE", undefined, "Manual rate removed.")} size="sm" variant="danger">Delete</AdminButton>
                    </div>
                  </div>
                ))
              ) : (
                <AdminEmptyState title="No manual rates" description="Add rates if checkout should work without live quotes." icon="paid" />
              )}
              <div className={styles.actionRow}>
                <AdminButton onClick={() => openManualRateDrawer(null)} size="sm" variant="secondary">
                  Add manual rate
                </AdminButton>
              </div>
            </section>

            <section className={styles.configSection}>
              <div className={styles.sectionHeading}><h3>Live-rate fallback</h3></div>
              <p className={styles.statusText}>Fallback rates are used only if live provider requests fail or time out.</p>
              {fallbackRates.length ? (
                fallbackRates.map((rate) => (
                  <div className={styles.configRow} key={rate.id}>
                    <p className={styles.statusText}>
                      <strong>{rate.name}</strong> | {formatMoney(rate.amount, currency)}
                    </p>
                    <div className={styles.actionRow}>
                      {!rate.isActive ? <AdminStatusChip tone="warning">Inactive</AdminStatusChip> : null}
                      <AdminButton onClick={() => openFallbackRateDrawer(rate)} size="sm" variant="secondary">Edit</AdminButton>
                      <AdminButton onClick={() => persistEntity(`/api/settings/shipping/fallback-rates/${rate.id}`, "DELETE", undefined, "Fallback rate removed.")} size="sm" variant="danger">Delete</AdminButton>
                    </div>
                  </div>
                ))
              ) : (
                <AdminEmptyState title="No fallback rates" description="Configure fallback rates for live provider outage paths." icon="error" />
              )}
              <div className={styles.actionRow}>
                <AdminButton onClick={() => openFallbackRateDrawer(null)} size="sm" variant="secondary">
                  Add fallback rate
                </AdminButton>
              </div>
            </section>

            <section className={styles.configSection}>
              <div className={styles.sectionHeading}><h3>Local options and documents</h3></div>
              <div className={styles.setupGrid}>
                <AdminCard as="article" className={styles.setupCard} variant="card">
                  <p className={styles.statusText}><strong>Manual fulfillment:</strong> Mark shipped and add tracking without label purchase.</p>
                </AdminCard>
                <AdminCard as="article" className={styles.setupCard} variant="card">
                  <p className={styles.statusText}><strong>Local delivery and pickup:</strong> Setup drawer can be added when backend activation lands.</p>
                </AdminCard>
                <AdminCard as="article" className={styles.setupCard} variant="card">
                  <p className={styles.statusText}><strong>Packing slip:</strong> Show settings after print flow ships.</p>
                </AdminCard>
              </div>
            </section>
          </div>
        ) : null}
      </div>

      <AdminDrawer
        open={providerDrawerOpen}
        onClose={() => setProviderDrawerOpen(false)}
        title="Live rate and label provider"
        subtitle="Save encrypted credentials, set usage, and verify connection."
      >
        <AdminField label="Provider">
          <AdminSelect
            value={provider}
            onChange={setProvider}
            options={[
              { value: "", label: "Select provider" },
              { value: "SHIPPO", label: "Shippo" },
              { value: "EASYPOST", label: "EasyPost" },
            ]}
          />
        </AdminField>

        <AdminField label="Provider usage">
          <AdminSelect
            value={providerUsage}
            onChange={setProviderUsage}
            options={[
              { value: "LIVE_AND_LABELS", label: "Live rates and label buying" },
              { value: "LABELS_ONLY", label: "Label buying only" },
              { value: "LIVE_RATES_ONLY", label: "Live rates only" },
            ]}
          />
        </AdminField>

        <AdminField label="API token">
          <AdminInput
            type="password"
            value={providerToken}
            onChange={(event) => setProviderToken(event.target.value)}
            placeholder="sk_live_..."
          />
        </AdminField>

        <p className={styles.statusText}>Stored secrets are encrypted and never shown again in settings.</p>

        <div className={styles.actionRow}>
          <AdminButton disabled={saving} onClick={saveProviderToken} size="sm" variant="secondary">Save credentials</AdminButton>
          <AdminButton disabled={saving} onClick={testProvider} size="sm" variant="secondary">Verify connection</AdminButton>
          <AdminButton disabled={saving} onClick={saveMode} size="sm" variant="secondary">Save usage</AdminButton>
        </div>

        {providerTestMessage ? <p className={styles.statusText}>{providerTestMessage}</p> : null}
      </AdminDrawer>

      <AdminDrawer
        open={packageDrawerOpen}
        onClose={() => setPackageDrawerOpen(false)}
        title={packageForm.id ? "Edit package" : "Add package"}
        subtitle="Used for live rates and label buying."
      >
        <AdminField label="Name">
          <AdminInput value={packageForm.name} onChange={(event) => setPackageForm((current) => ({ ...current, name: event.target.value }))} />
        </AdminField>
        <AdminField label="Type">
          <AdminSelect value={packageForm.type} onChange={(value) => setPackageForm((current) => ({ ...current, type: value }))} options={[{ value: "BOX", label: "Box" }, { value: "POLY_MAILER", label: "Poly mailer" }, { value: "ENVELOPE", label: "Envelope" }, { value: "CUSTOM", label: "Custom" }]} />
        </AdminField>
        <AdminField label="Length">
          <AdminInput type="number" value={packageForm.length} onChange={(event) => setPackageForm((current) => ({ ...current, length: event.target.value }))} />
        </AdminField>
        <AdminField label="Width">
          <AdminInput type="number" value={packageForm.width} onChange={(event) => setPackageForm((current) => ({ ...current, width: event.target.value }))} />
        </AdminField>
        <AdminField label="Height">
          <AdminInput type="number" value={packageForm.height} onChange={(event) => setPackageForm((current) => ({ ...current, height: event.target.value }))} />
        </AdminField>
        <AdminField label="Dimension unit">
          <AdminSelect value={packageForm.dimensionUnit} onChange={(value) => setPackageForm((current) => ({ ...current, dimensionUnit: value }))} options={[{ value: "IN", label: "IN" }, { value: "CM", label: "CM" }]} />
        </AdminField>
        <AdminField label="Empty package weight">
          <AdminInput type="number" value={packageForm.emptyPackageWeight} onChange={(event) => setPackageForm((current) => ({ ...current, emptyPackageWeight: event.target.value }))} />
        </AdminField>
        <AdminField label="Weight unit">
          <AdminSelect value={packageForm.weightUnit} onChange={(value) => setPackageForm((current) => ({ ...current, weightUnit: value }))} options={[{ value: "OZ", label: "OZ" }, { value: "LB", label: "LB" }, { value: "G", label: "G" }, { value: "KG", label: "KG" }]} />
        </AdminField>
        <label className={styles.checkboxField}><input checked={Boolean(packageForm.isDefault)} onChange={(event) => setPackageForm((current) => ({ ...current, isDefault: event.target.checked }))} type="checkbox" /><span>Default package</span></label>
        <label className={styles.checkboxField}><input checked={Boolean(packageForm.isActive)} onChange={(event) => setPackageForm((current) => ({ ...current, isActive: event.target.checked }))} type="checkbox" /><span>Active</span></label>
        <div className={styles.actionRow}>
          <AdminButton disabled={saving} onClick={savePackage} size="sm">Save package</AdminButton>
        </div>
      </AdminDrawer>

      <AdminDrawer
        open={locationDrawerOpen}
        onClose={() => setLocationDrawerOpen(false)}
        title={locationForm.id ? "Edit ship-from location" : "Add ship-from location"}
        subtitle="Used for live rates, labels, return labels, and packing slips."
      >
        <AdminField label="Name"><AdminInput value={locationForm.name} onChange={(event) => setLocationForm((current) => ({ ...current, name: event.target.value }))} /></AdminField>
        <AdminField label="Contact name"><AdminInput value={locationForm.contactName} onChange={(event) => setLocationForm((current) => ({ ...current, contactName: event.target.value }))} /></AdminField>
        <AdminField label="Company"><AdminInput value={locationForm.company} onChange={(event) => setLocationForm((current) => ({ ...current, company: event.target.value }))} /></AdminField>
        <AdminField label="Address line 1"><AdminInput value={locationForm.address1} onChange={(event) => setLocationForm((current) => ({ ...current, address1: event.target.value }))} /></AdminField>
        <AdminField label="Address line 2"><AdminInput value={locationForm.address2} onChange={(event) => setLocationForm((current) => ({ ...current, address2: event.target.value }))} /></AdminField>
        <AdminField label="City"><AdminInput value={locationForm.city} onChange={(event) => setLocationForm((current) => ({ ...current, city: event.target.value }))} /></AdminField>
        <AdminField label="State / province"><AdminInput value={locationForm.stateProvince} onChange={(event) => setLocationForm((current) => ({ ...current, stateProvince: event.target.value }))} /></AdminField>
        <AdminField label="Postal code"><AdminInput value={locationForm.postalCode} onChange={(event) => setLocationForm((current) => ({ ...current, postalCode: event.target.value }))} /></AdminField>
        <AdminField label="Country"><AdminInput value={locationForm.country} onChange={(event) => setLocationForm((current) => ({ ...current, country: event.target.value }))} /></AdminField>
        <AdminField label="Phone"><AdminInput value={locationForm.phone} onChange={(event) => setLocationForm((current) => ({ ...current, phone: event.target.value }))} /></AdminField>
        <label className={styles.checkboxField}><input checked={Boolean(locationForm.isDefault)} onChange={(event) => setLocationForm((current) => ({ ...current, isDefault: event.target.checked }))} type="checkbox" /><span>Default location</span></label>
        <label className={styles.checkboxField}><input checked={Boolean(locationForm.isActive)} onChange={(event) => setLocationForm((current) => ({ ...current, isActive: event.target.checked }))} type="checkbox" /><span>Active</span></label>
        <div className={styles.actionRow}>
          <AdminButton disabled={saving} onClick={saveLocation} size="sm">Save location</AdminButton>
          <AdminButton disabled={saving} onClick={validateLocationAddress} size="sm" variant="secondary">Validate address</AdminButton>
        </div>
        {locationValidationMessage ? <p className={styles.statusText}>{locationValidationMessage}</p> : null}
      </AdminDrawer>

      <AdminDrawer
        open={manualDrawerOpen}
        onClose={() => setManualDrawerOpen(false)}
        title={manualForm.id ? "Edit manual checkout rate" : "Add manual checkout rate"}
        subtitle="Manual rates change checkout price only."
      >
        <AdminField label="Name"><AdminInput value={manualForm.name} onChange={(event) => setManualForm((current) => ({ ...current, name: event.target.value }))} /></AdminField>
        <AdminField label="Region country"><AdminInput value={manualForm.regionCountry} onChange={(event) => setManualForm((current) => ({ ...current, regionCountry: event.target.value }))} /></AdminField>
        <AdminField label="Region state / province"><AdminInput value={manualForm.regionStateProvince} onChange={(event) => setManualForm((current) => ({ ...current, regionStateProvince: event.target.value }))} /></AdminField>
        <AdminField label="Rate type"><AdminSelect value={manualForm.rateType} onChange={(value) => setManualForm((current) => ({ ...current, rateType: value }))} options={[{ value: "FLAT", label: "Flat" }, { value: "FREE", label: "Free" }, { value: "WEIGHT_BASED", label: "Weight-based" }, { value: "PRICE_BASED", label: "Price-based" }]} /></AdminField>
        <AdminField label="Amount"><AdminInput type="number" value={manualForm.amount} onChange={(event) => setManualForm((current) => ({ ...current, amount: event.target.value }))} /></AdminField>
        <AdminField label="Min weight"><AdminInput type="number" value={manualForm.minWeight} onChange={(event) => setManualForm((current) => ({ ...current, minWeight: event.target.value }))} /></AdminField>
        <AdminField label="Max weight"><AdminInput type="number" value={manualForm.maxWeight} onChange={(event) => setManualForm((current) => ({ ...current, maxWeight: event.target.value }))} /></AdminField>
        <AdminField label="Min subtotal"><AdminInput type="number" value={manualForm.minSubtotal} onChange={(event) => setManualForm((current) => ({ ...current, minSubtotal: event.target.value }))} /></AdminField>
        <AdminField label="Max subtotal"><AdminInput type="number" value={manualForm.maxSubtotal} onChange={(event) => setManualForm((current) => ({ ...current, maxSubtotal: event.target.value }))} /></AdminField>
        <AdminField label="Free over amount"><AdminInput type="number" value={manualForm.freeOverAmount} onChange={(event) => setManualForm((current) => ({ ...current, freeOverAmount: event.target.value }))} /></AdminField>
        <AdminField label="Estimated delivery text"><AdminInput value={manualForm.estimatedDeliveryText} onChange={(event) => setManualForm((current) => ({ ...current, estimatedDeliveryText: event.target.value }))} /></AdminField>
        <label className={styles.checkboxField}><input checked={Boolean(manualForm.isActive)} onChange={(event) => setManualForm((current) => ({ ...current, isActive: event.target.checked }))} type="checkbox" /><span>Active</span></label>
        <div className={styles.actionRow}><AdminButton disabled={saving} onClick={saveManualRate} size="sm">Save manual rate</AdminButton></div>
      </AdminDrawer>

      <AdminDrawer
        open={fallbackDrawerOpen}
        onClose={() => setFallbackDrawerOpen(false)}
        title={fallbackForm.id ? "Edit live-rate fallback" : "Add live-rate fallback"}
        subtitle="Fallback rates are used only when live provider requests fail."
      >
        <AdminField label="Name"><AdminInput value={fallbackForm.name} onChange={(event) => setFallbackForm((current) => ({ ...current, name: event.target.value }))} /></AdminField>
        <AdminField label="Region country"><AdminInput value={fallbackForm.regionCountry} onChange={(event) => setFallbackForm((current) => ({ ...current, regionCountry: event.target.value }))} /></AdminField>
        <AdminField label="Region state / province"><AdminInput value={fallbackForm.regionStateProvince} onChange={(event) => setFallbackForm((current) => ({ ...current, regionStateProvince: event.target.value }))} /></AdminField>
        <AdminField label="Amount"><AdminInput type="number" value={fallbackForm.amount} onChange={(event) => setFallbackForm((current) => ({ ...current, amount: event.target.value }))} /></AdminField>
        <AdminField label="Estimated delivery text"><AdminInput value={fallbackForm.estimatedDeliveryText} onChange={(event) => setFallbackForm((current) => ({ ...current, estimatedDeliveryText: event.target.value }))} /></AdminField>
        <label className={styles.checkboxField}><input checked={Boolean(fallbackForm.isActive)} onChange={(event) => setFallbackForm((current) => ({ ...current, isActive: event.target.checked }))} type="checkbox" /><span>Active</span></label>
        <div className={styles.actionRow}><AdminButton disabled={saving} onClick={saveFallbackRate} size="sm">Save fallback rate</AdminButton></div>
      </AdminDrawer>
    </AppShell>
  );
}
