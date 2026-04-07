"use client";

import { useMemo } from 'react';
import { useProductStore } from '../../context/ProductContext';
import styles from './ProductVariantEditor.module.css';

function OptionValueChips({ option, actions }) {
  return (
    <div className={styles.optionCard}>
      <div className={styles.optionHeaderRow}>
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
      <div className={styles.optionChipRow}>
        {option.values.map(value => (
          <span key={`${option.id}-${value}`} className={styles.optionChip}>
            {value}
          </span>
        ))}
      </div>
      <textarea
        aria-label="Option values"
        className={styles.optionValuesInput}
        onChange={event => actions.updateOptionValues(option.id, event.target.value)}
        placeholder="Small, Medium, Large"
        rows={2}
        value={option.values.join(', ')}
      />
    </div>
  );
}

export default function ProductVariantEditor() {
  const { editor, actions } = useProductStore();
  const draftProduct = editor.draftProduct;
  const variantRowErrors = editor.validationErrors.variantRows || {};

  const totalInventory = useMemo(
    () => draftProduct?.variants?.reduce((sum, variant) => sum + (Number.parseInt(variant.inventoryQty, 10) || 0), 0) || 0,
    [draftProduct]
  );

  if (!draftProduct) {
    return null;
  }

  return (
    <div className={styles.variantShell}>
      <div className={styles.variantHeaderRow}>
        <h4 className={styles.variantSectionTitle}>Variants</h4>
        <button className={styles.addVariantButton} onClick={() => actions.addVariant()} type="button">
          <span className="material-symbols-outlined">add</span>
          Add variant
        </button>
      </div>

      <div className={styles.optionPanel}>
        {draftProduct.options.length ? (
          draftProduct.options.map(option => <OptionValueChips key={option.id} option={option} actions={actions} />)
        ) : (
          <div className={styles.emptyOptionState}>
            <p className={styles.emptyOptionTitle}>Single default variant</p>
            <p className={styles.emptyOptionText}>Add an option like Size or Color to generate variant rows.</p>
          </div>
        )}

        <button className={styles.addOptionLink} onClick={() => actions.addOptionGroup()} type="button">
          <span className="material-symbols-outlined">add_circle</span>
          Add another option
        </button>
      </div>

      {editor.validationErrors.options ? <p className={styles.errorText}>{editor.validationErrors.options}</p> : null}
      {editor.validationErrors.variants ? <p className={styles.errorText}>{editor.validationErrors.variants}</p> : null}

      <div className={styles.matrixWrap}>
        <div className={styles.matrixHeader}>
          <div className={styles.matrixColumnVariant}>Variant</div>
          <div className={styles.matrixColumnPrice}>Price</div>
          <div className={styles.matrixColumnInventory}>Available</div>
        </div>

        <div className={styles.matrixBody}>
          {draftProduct.variants.map(variant => (
            <div key={variant.id} className={styles.variantRow}>
              <div className={styles.variantIdentityCell}>
                <div className={styles.variantThumbPlaceholder}>
                  <span className="material-symbols-outlined">image</span>
                </div>
                <div className={styles.variantIdentityText}>
                  <div className={styles.variantName}>{variant.title}</div>
                  <input
                    className={styles.inlineSkuInput}
                    onChange={event => actions.updateVariantField(variant.id, 'sku', event.target.value)}
                    placeholder="SKU"
                    type="text"
                    value={variant.sku}
                  />
                  {variantRowErrors[variant.id]?.sku ? <small className={styles.cellError}>{variantRowErrors[variant.id].sku}</small> : null}
                </div>
              </div>

              <div className={styles.variantPriceCell}>
                <input
                  className={styles.priceInput}
                  onChange={event => actions.updateVariantField(variant.id, 'price', event.target.value)}
                  type="text"
                  value={variant.price}
                />
                {variantRowErrors[variant.id]?.price ? <small className={styles.cellError}>{variantRowErrors[variant.id].price}</small> : null}
              </div>

              <div className={styles.variantInventoryCell}>
                <input
                  className={styles.inventoryInput}
                  min="0"
                  onChange={event => actions.updateVariantField(variant.id, 'inventoryQty', event.target.value)}
                  type="number"
                  value={variant.inventoryQty}
                />
                {variantRowErrors[variant.id]?.inventoryQty ? <small className={styles.cellError}>{variantRowErrors[variant.id].inventoryQty}</small> : null}
              </div>
            </div>
          ))}
        </div>

        <div className={styles.matrixFooter}>Total inventory: {totalInventory} available</div>
      </div>
    </div>
  );
}
