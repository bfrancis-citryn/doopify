"use client";

import { useProductStore } from '../../context/ProductContext';
import styles from './ProductVariantEditor.module.css';

export default function ProductVariantEditor() {
  const { editor, actions } = useProductStore();
  const draftProduct = editor.draftProduct;
  const variantRowErrors = editor.validationErrors.variantRows || {};

  if (!draftProduct) {
    return null;
  }

  return (
    <div className={styles.variantShell}>
      <div className={styles.toolbar}>
        <div>
          <p className={styles.toolbarTitle}>Option groups</p>
          <p className={styles.toolbarText}>Define option names and comma-separated values to generate the variant matrix.</p>
        </div>
        <button className={styles.addButton} onClick={() => actions.addOptionGroup()} type="button">
          <span className="material-symbols-outlined">add</span>
          Add another option
        </button>
      </div>

      <div className={styles.optionList}>
        {draftProduct.options.length ? (
          draftProduct.options.map(option => (
            <div key={option.id} className={styles.optionCard}>
              <div className={styles.optionHeader}>
                <input
                  aria-label="Option name"
                  className={styles.optionNameInput}
                  onChange={event => actions.updateOptionName(option.id, event.target.value)}
                  placeholder="Size"
                  type="text"
                  value={option.name}
                />
                <button className={styles.optionDelete} onClick={() => actions.removeOptionGroup(option.id)} type="button">
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              <textarea
                aria-label="Option values"
                className={styles.optionValuesInput}
                onChange={event => actions.updateOptionValues(option.id, event.target.value)}
                placeholder="S, M, L, XL"
                rows={2}
                value={option.values.join(', ')}
              />
            </div>
          ))
        ) : (
          <div className={styles.helperCard}>
            <span className="material-symbols-outlined">conversion_path</span>
            <div>
              <p className={`font-headline ${styles.helperTitle}`}>Single default variant</p>
              <p className={styles.helperText}>This product currently uses one default variant. Add Size, Color, or Material to generate more combinations.</p>
            </div>
          </div>
        )}
      </div>

      {editor.validationErrors.options ? <p className={styles.errorText}>{editor.validationErrors.options}</p> : null}

      <div className={styles.toolbar}>
        <div>
          <p className={styles.toolbarTitle}>Variant matrix</p>
          <p className={styles.toolbarText}>{draftProduct.variants.length} variant{draftProduct.variants.length > 1 ? 's' : ''} generated from the current option setup.</p>
        </div>
        <button className={styles.addButton} onClick={() => actions.addVariant()} type="button">
          <span className="material-symbols-outlined">add</span>
          Add variant
        </button>
      </div>

      {editor.validationErrors.variants ? <p className={styles.errorText}>{editor.validationErrors.variants}</p> : null}

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Variant</th>
              <th>SKU</th>
              <th>Price</th>
              <th>Compare-at</th>
              <th>Inventory</th>
              <th>Media</th>
              <th>Active</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {draftProduct.variants.map(variant => (
              <tr key={variant.id}>
                <td>
                  <div className={styles.cellField}>
                    <input
                      aria-label="Variant label"
                      className={styles.tableInput}
                      onChange={event => actions.updateVariantField(variant.id, 'title', event.target.value)}
                      type="text"
                      value={variant.title}
                    />
                    <div className={styles.variantTitle}>
                      {variant.isDefault ? <small>Default</small> : <small>Generated from option values</small>}
                    </div>
                  </div>
                </td>
                <td>
                  <div className={styles.cellField}>
                    <input
                      className={styles.tableInput}
                      onChange={event => actions.updateVariantField(variant.id, 'sku', event.target.value)}
                      type="text"
                      value={variant.sku}
                    />
                    {variantRowErrors[variant.id]?.sku ? <small className={styles.cellError}>{variantRowErrors[variant.id].sku}</small> : null}
                  </div>
                </td>
                <td>
                  <div className={styles.cellField}>
                    <input
                      className={styles.tableInput}
                      onChange={event => actions.updateVariantField(variant.id, 'price', event.target.value)}
                      type="text"
                      value={variant.price}
                    />
                    {variantRowErrors[variant.id]?.price ? <small className={styles.cellError}>{variantRowErrors[variant.id].price}</small> : null}
                  </div>
                </td>
                <td>
                  <div className={styles.cellField}>
                    <input
                      className={styles.tableInput}
                      onChange={event => actions.updateVariantField(variant.id, 'compareAtPrice', event.target.value)}
                      type="text"
                      value={variant.compareAtPrice}
                    />
                    {variantRowErrors[variant.id]?.compareAtPrice ? (
                      <small className={styles.cellError}>{variantRowErrors[variant.id].compareAtPrice}</small>
                    ) : null}
                  </div>
                </td>
                <td>
                  <div className={styles.cellField}>
                    <input
                      className={styles.tableInput}
                      min="0"
                      onChange={event => actions.updateVariantField(variant.id, 'inventoryQty', event.target.value)}
                      type="number"
                      value={variant.inventoryQty}
                    />
                    {variantRowErrors[variant.id]?.inventoryQty ? (
                      <small className={styles.cellError}>{variantRowErrors[variant.id].inventoryQty}</small>
                    ) : null}
                  </div>
                </td>
                <td>
                  <select
                    className={styles.tableSelect}
                    onChange={event => actions.updateVariantField(variant.id, 'imageId', event.target.value || null)}
                    value={variant.imageId || ''}
                  >
                    <option value="">None</option>
                    {draftProduct.images.map(image => (
                      <option key={image.id} value={image.id}>
                        {image.alt}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <label className={styles.toggle}>
                    <input
                      checked={Boolean(variant.isActive)}
                      onChange={event => actions.updateVariantField(variant.id, 'isActive', event.target.checked)}
                      type="checkbox"
                    />
                    <span>{variant.isActive ? 'On' : 'Off'}</span>
                  </label>
                </td>
                <td>
                  <button className={styles.deleteVariant} onClick={() => actions.requestDeleteVariant(variant.id)} type="button">
                    <span className="material-symbols-outlined">delete</span>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
