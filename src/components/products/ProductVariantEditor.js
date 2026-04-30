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

          <div className={styles.optionFooter}>
            <button className={styles.deleteOptionButton} onClick={() => actions.removeOptionGroup(option.id)} type="button">
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function GroupedVariantRows({ draftProduct, actions, formatMoney, variantRowErrors }) {
  const [expandedGroupKey, setExpandedGroupKey] = useState(null);
  const primaryOption = draftProduct.options[0];
  const secondaryOption = draftProduct.options[1];
  const grouped = primaryOption
    ? primaryOption.values.map(value => {
        const variants = draftProduct.variants.filter(variant => variant.optionValues?.[primaryOption.name] === value);
        return {
          key: value,
          label: value,
          variants,
        };
      })
    : [];

  return (
    <>
      {grouped.map(group => {
        const totalAvailable = group.variants.reduce((sum, variant) => sum + (Number.parseInt(variant.inventoryQty, 10) || 0), 0);
        const groupPrice = group.variants[0]?.price || draftProduct.basePrice;
        const isExpanded = expandedGroupKey === group.key;

        return (
          <div key={group.key} className={styles.groupBlock}>
            <div className={styles.groupRow}>
              <div className={styles.checkboxColumn}>
                <input type="checkbox" />
              </div>
              <button className={styles.groupIdentityCell} onClick={() => setExpandedGroupKey(isExpanded ? null : group.key)} type="button">
                <div className={styles.variantThumbPlaceholder}>
                  <span className="material-symbols-outlined">add_photo_alternate</span>
                </div>
                <div className={styles.variantIdentityText}>
                  <div className={styles.variantName}>{group.label}</div>
                  <div className={styles.groupMeta}>
                    {group.variants.length} variant{group.variants.length > 1 ? 's' : ''}
                    <span className="material-symbols-outlined">{isExpanded ? 'expand_less' : 'expand_more'}</span>
                  </div>
                </div>
              </button>
              <div className={styles.variantSkuCell}>
                <span className={styles.mutedText}>Multiple SKUs</span>
              </div>
              <div className={styles.variantPriceCell}>
                <div className={styles.currencyInputWrap}>
                  <span className={styles.currencyPrefix}>$</span>
                  <input className={styles.priceInput} readOnly type="text" value={groupPrice} />
                </div>
                <small className={styles.secondaryLine}>{formatMoney(groupPrice)}</small>
              </div>
              <div className={styles.variantInventoryCell}>
                <input className={styles.inventoryInput} readOnly type="number" value={totalAvailable} />
              </div>
            </div>

            {isExpanded && secondaryOption ? (
              <div className={styles.subRowList}>
                {group.variants.map(variant => (
                  <div key={variant.id} className={styles.subVariantRow}>
                    {(() => {
                      const rowErrors = variantRowErrors?.[variant.id] || {};
                      return (
                        <>
                    <div className={styles.checkboxColumn}>
                      <input type="checkbox" />
                    </div>
                    <div className={styles.subVariantIdentity}>
                      <div className={styles.subVariantSpacer} />
                      <div className={styles.variantIdentityText}>
                        <div className={styles.variantName}>{variant.optionValues?.[secondaryOption.name] || variant.title}</div>
                        {rowErrors.optionValues ? <p className={styles.fieldErrorText}>{rowErrors.optionValues}</p> : null}
                      </div>
                      <button className={styles.deleteVariantButton} onClick={() => actions.requestDeleteVariant(variant.id)} type="button">
                        Delete
                      </button>
                    </div>
                    <div className={styles.variantSkuCell}>
                      <input
                        className={rowErrors.sku ? `${styles.skuInput} ${styles.inputError}` : styles.skuInput}
                        onChange={event => actions.updateVariantField(variant.id, 'sku', event.target.value)}
                        placeholder="SKU"
                        type="text"
                        value={variant.sku}
                      />
                      {rowErrors.sku ? <p className={styles.fieldErrorText}>{rowErrors.sku}</p> : null}
                    </div>
                    <div className={styles.variantPriceCell}>
                      <div className={styles.currencyInputWrap}>
                        <span className={styles.currencyPrefix}>$</span>
                        <input
                          className={rowErrors.price || rowErrors.compareAtPrice ? `${styles.priceInput} ${styles.inputError}` : styles.priceInput}
                          onChange={event => actions.updateVariantField(variant.id, 'price', event.target.value)}
                          type="text"
                          value={variant.price}
                        />
                      </div>
                      {rowErrors.price ? <p className={styles.fieldErrorText}>{rowErrors.price}</p> : null}
                      {rowErrors.compareAtPrice ? <p className={styles.fieldErrorText}>{rowErrors.compareAtPrice}</p> : null}
                    </div>
                    <div className={styles.variantInventoryCell}>
                      <input
                        className={rowErrors.inventoryQty ? `${styles.inventoryInput} ${styles.inputError}` : styles.inventoryInput}
                        min="0"
                        onChange={event => actions.updateVariantField(variant.id, 'inventoryQty', event.target.value)}
                        type="number"
                        value={variant.inventoryQty}
                      />
                      {rowErrors.inventoryQty ? <p className={styles.fieldErrorText}>{rowErrors.inventoryQty}</p> : null}
                    </div>
                        </>
                      );
                    })()}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
    </>
  );
}

function BasicInventoryCard({ draftProduct, actions }) {
  const baseVariant = draftProduct.variants[0];
  const inventoryQty = baseVariant?.inventoryQty ?? 0;

  return (
    <div className={styles.basicInventoryCard}>
      <div className={styles.basicInventoryHeader}>
        <h4 className={styles.basicInventoryTitle}>Inventory</h4>
        <label className={styles.inventoryTrackedToggle}>
          <span>Inventory tracked</span>
          <input checked readOnly type="checkbox" />
        </label>
      </div>

      <div className={styles.basicInventoryTable}>
        <div className={styles.basicInventoryRow}>
          <span>Quantity</span>
          <span>Quantity</span>
        </div>
        <div className={styles.basicInventoryRow}>
          <span>{draftProduct.vendor || 'Default location'}</span>
          <input
            className={styles.inventoryInput}
            min="0"
            onChange={event => actions.updateVariantField(baseVariant.id, 'inventoryQty', event.target.value)}
            type="number"
            value={inventoryQty}
          />
        </div>
      </div>
    </div>
  );
}

export default function ProductVariantEditor() {
  const { editor, actions, formatMoney } = useProductStore();
  const draftProduct = editor.draftProduct;
  const variantRowErrors = editor.validationErrors.variantRows || {};
  const optionErrorMessage = editor.validationErrors.options || '';
  const totalInventory = useMemo(
    () => draftProduct?.variants?.reduce((sum, variant) => sum + (Number.parseInt(variant.inventoryQty, 10) || 0), 0) || 0,
    [draftProduct]
  );

  if (!draftProduct) {
    return null;
  }

  const hasRealVariants = draftProduct.options.length > 0;
  const canGroupVariants = draftProduct.options.length > 1;

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
              errorMessage={optionErrorMessage}
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
      {editor.validationErrors.variants && !Object.keys(variantRowErrors).length ? (
        <p className={styles.errorText}>{editor.validationErrors.variants}</p>
      ) : null}

      {hasRealVariants ? (
        <>
          <div className={styles.matrixTools}>
            {canGroupVariants ? <div className={styles.groupByChip}>Group by {draftProduct.options[0].name}</div> : null}
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
              <div className={styles.skuColumn}>SKU</div>
              <div className={styles.priceColumn}>Price</div>
              <div className={styles.inventoryColumn}>Available</div>
            </div>

            <div className={styles.matrixBody}>
              {canGroupVariants ? (
                <GroupedVariantRows draftProduct={draftProduct} actions={actions} formatMoney={formatMoney} variantRowErrors={variantRowErrors} />
              ) : (
                draftProduct.variants.map(variant => (
                  <div key={variant.id} className={styles.variantRow}>
                    {(() => {
                      const rowErrors = variantRowErrors?.[variant.id] || {};
                      return (
                        <>
                    <div className={styles.checkboxColumn}>
                      <input type="checkbox" />
                    </div>

                    <div className={styles.variantIdentityCell}>
                      <div className={styles.variantThumbPlaceholder}>
                        <span className="material-symbols-outlined">add_photo_alternate</span>
                      </div>
                      <div className={styles.variantIdentityText}>
                        <div className={styles.variantName}>{variant.title}</div>
                        {rowErrors.optionValues ? <p className={styles.fieldErrorText}>{rowErrors.optionValues}</p> : null}
                      </div>
                      <button className={styles.deleteVariantButton} onClick={() => actions.requestDeleteVariant(variant.id)} type="button">
                        Delete
                      </button>
                    </div>
                    <div className={styles.variantSkuCell}>
                      <input
                        className={rowErrors.sku ? `${styles.skuInput} ${styles.inputError}` : styles.skuInput}
                        onChange={event => actions.updateVariantField(variant.id, 'sku', event.target.value)}
                        placeholder="SKU"
                        type="text"
                        value={variant.sku}
                      />
                      {rowErrors.sku ? <p className={styles.fieldErrorText}>{rowErrors.sku}</p> : null}
                    </div>

                    <div className={styles.variantPriceCell}>
                      <div className={styles.currencyInputWrap}>
                        <span className={styles.currencyPrefix}>$</span>
                        <input
                          className={rowErrors.price || rowErrors.compareAtPrice ? `${styles.priceInput} ${styles.inputError}` : styles.priceInput}
                          onChange={event => actions.updateVariantField(variant.id, 'price', event.target.value)}
                          type="text"
                          value={variant.price}
                        />
                      </div>
                      {rowErrors.price ? <p className={styles.fieldErrorText}>{rowErrors.price}</p> : null}
                      {rowErrors.compareAtPrice ? <p className={styles.fieldErrorText}>{rowErrors.compareAtPrice}</p> : null}
                      <small className={styles.secondaryLine}>{formatMoney(variant.price)}</small>
                    </div>

                    <div className={styles.variantInventoryCell}>
                      <input
                        className={rowErrors.inventoryQty ? `${styles.inventoryInput} ${styles.inputError}` : styles.inventoryInput}
                        min="0"
                        onChange={event => actions.updateVariantField(variant.id, 'inventoryQty', event.target.value)}
                        type="number"
                        value={variant.inventoryQty}
                      />
                      {rowErrors.inventoryQty ? <p className={styles.fieldErrorText}>{rowErrors.inventoryQty}</p> : null}
                    </div>
                        </>
                      );
                    })()}
                  </div>
                ))
              )}
            </div>

            <div className={styles.matrixFooter}>Total inventory available: {totalInventory}</div>
          </div>
        </>
      ) : (
        <BasicInventoryCard draftProduct={draftProduct} actions={actions} />
      )}
    </div>
  );
}
