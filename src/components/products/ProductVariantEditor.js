"use client";

import { useMemo, useState } from 'react';
import { useProductStore } from '../../context/ProductContext';
import styles from './ProductVariantEditor.module.css';

const DEFAULT_OPTION_SUGGESTIONS = {
  Size: ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'],
  Color: ['Black', 'White', 'Blue', 'Red', 'Green'],
  Material: ['Cotton', 'Wool', 'Leather'],
  Style: ['Classic', 'Modern'],
};

function OptionEditor({ option, actions, errorMessage }) {
  const [draftValue, setDraftValue] = useState('');
  const suggestions = DEFAULT_OPTION_SUGGESTIONS[option.name] || [];

  const submitValue = value => {
    const normalizedValue = value.trim();
    if (!normalizedValue) {
      return;
    }

    actions.addOptionValue(option.id, normalizedValue);
    setDraftValue('');
  };

  return (
    <div className={styles.optionCard}>
      <div className={styles.optionDragHandle}>
        <span className="material-symbols-outlined">drag_indicator</span>
      </div>

      <div className={styles.optionBody}>
        <div className={styles.optionNameLabel}>Option name</div>
        <input
          aria-label="Option name"
          className={errorMessage ? `${styles.optionNameInput} ${styles.optionNameInputError}` : styles.optionNameInput}
          onChange={event => actions.updateOptionName(option.id, event.target.value)}
          placeholder="Size"
          type="text"
          value={option.name}
        />
        {errorMessage ? <p className={styles.optionError}>{errorMessage}</p> : null}

        <div className={styles.valueComposer}>
          <div className={styles.optionChipRow}>
            {option.values.map(value => (
              <button
                key={`${option.id}-${value}`}
                className={styles.optionChip}
                onClick={() => actions.removeOptionValue(option.id, value)}
                type="button"
              >
                <span>{value}</span>
                <span className="material-symbols-outlined">close</span>
              </button>
            ))}
            <input
              className={styles.valueInput}
              onChange={event => setDraftValue(event.target.value)}
              onKeyDown={event => {
                if (event.key === 'Enter' || event.key === ',') {
                  event.preventDefault();
                  submitValue(draftValue);
                }
              }}
              placeholder={`Add ${option.name.toLowerCase() || 'value'}`}
              type="text"
              value={draftValue}
            />
          </div>

          {suggestions.length ? (
            <div className={styles.suggestionList}>
              <p className={styles.suggestionTitle}>Default entries</p>
              <div className={styles.suggestionGrid}>
                {suggestions.map(suggestion => {
                  const isSelected = option.values.includes(suggestion);
                  return (
                    <label key={`${option.id}-${suggestion}`} className={styles.suggestionItem}>
                      <input
                        checked={isSelected}
                        onChange={event => {
                          if (event.target.checked) {
                            actions.addOptionValue(option.id, suggestion);
                          } else {
                            actions.removeOptionValue(option.id, suggestion);
                          }
                        }}
                        type="checkbox"
                      />
                      <span>{suggestion}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default function ProductVariantEditor() {
  const { editor, actions, formatMoney } = useProductStore();
  const draftProduct = editor.draftProduct;
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
          draftProduct.options.map(option => (
            <OptionEditor
              key={option.id}
              option={option}
              actions={actions}
              errorMessage={editor.validationErrors.options?.includes(option.name) ? editor.validationErrors.options : ''}
            />
          ))
        ) : (
          <div className={styles.emptyOptionState}>
            <p className={styles.emptyOptionTitle}>Single default variant</p>
            <p className={styles.emptyOptionText}>Add an option like Size, Color, or Material to generate Shopify-style variants.</p>
          </div>
        )}

        <button className={styles.addOptionLink} onClick={() => actions.addOptionGroup()} type="button">
          <span className="material-symbols-outlined">add_circle</span>
          Add another option
        </button>
      </div>

      {editor.validationErrors.options && !draftProduct.options.some(option => editor.validationErrors.options?.includes(option.name)) ? (
        <p className={styles.errorText}>{editor.validationErrors.options}</p>
      ) : null}
      {editor.validationErrors.variants ? <p className={styles.errorText}>{editor.validationErrors.variants}</p> : null}

      <div className={styles.matrixTools}>
        <button className={styles.matrixToolButton} type="button">
          <span className="material-symbols-outlined">search</span>
        </button>
        <button className={styles.matrixToolButton} type="button">
          <span className="material-symbols-outlined">filter_list</span>
        </button>
      </div>

      <div className={styles.matrixWrap}>
        <div className={styles.matrixHeader}>
          <div className={styles.checkboxColumn}><input type="checkbox" /></div>
          <div className={styles.variantColumn}>Variant</div>
          <div className={styles.priceColumn}>Price</div>
          <div className={styles.inventoryColumn}>Available</div>
        </div>

        <div className={styles.matrixBody}>
          {draftProduct.variants.map(variant => (
            <div key={variant.id} className={styles.variantRow}>
              <div className={styles.checkboxColumn}>
                <input type="checkbox" />
              </div>

              <div className={styles.variantIdentityCell}>
                <div className={styles.variantThumbPlaceholder}>
                  <span className="material-symbols-outlined">add_photo_alternate</span>
                </div>
                <div className={styles.variantIdentityText}>
                  <div className={styles.variantName}>{variant.title}</div>
                </div>
              </div>

              <div className={styles.variantPriceCell}>
                <div className={styles.currencyInputWrap}>
                  <span className={styles.currencyPrefix}>$</span>
                  <input
                    className={styles.priceInput}
                    onChange={event => actions.updateVariantField(variant.id, 'price', event.target.value)}
                    type="text"
                    value={variant.price}
                  />
                </div>
                <small className={styles.secondaryLine}>{formatMoney(variant.price)}</small>
              </div>

              <div className={styles.variantInventoryCell}>
                <input
                  className={styles.inventoryInput}
                  min="0"
                  onChange={event => actions.updateVariantField(variant.id, 'inventoryQty', event.target.value)}
                  type="number"
                  value={variant.inventoryQty}
                />
              </div>
            </div>
          ))}
        </div>

        <div className={styles.matrixFooter}>Total inventory available: {totalInventory}</div>
      </div>
    </div>
  );
}
