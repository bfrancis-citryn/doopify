"use client";

import Image from 'next/image';
import { useState } from 'react';
import { useProductStore } from '../../context/ProductContext';
import styles from './ProductDetail.module.css';

export default function ProductDetail({ onClose, product }) {
  const { updateProductVariants } = useProductStore();
  const [variants, setVariants] = useState(product?.variants || []);
  const [isSaved, setIsSaved] = useState(true);

  const addVariant = () => {
    const newId = variants.length > 0 ? Math.max(...variants.map(v => v.id)) + 1 : 1;
    setVariants([...variants, { id: newId, name: `Custom Variant ${newId}`, price: "0.00", available: 0 }]);
    setIsSaved(false);
  };

  const removeVariant = (idToRemove) => {
    setVariants(variants.filter(v => v.id !== idToRemove));
    setIsSaved(false);
  };

  const updateVariantField = (idToUpdate, field, value) => {
    setVariants(variants.map(v => v.id === idToUpdate ? { ...v, [field]: value } : v));
    setIsSaved(false);
  };

  const handleUpdateStore = () => {
    if (product) {
      updateProductVariants(product.id, variants);
      setIsSaved(true);
    }
  };

  if (!product) {
    return <div className={`custom-scrollbar refraction-edge ${styles.container}`}></div>;
  }

  return (
    <div className={`custom-scrollbar refraction-edge ${styles.container}`}>
      <div className={styles.innerContent}>
        
        {/* Header Section */}
        <div className={styles.header}>
          <div className={styles.headerInfo}>
            <div className={styles.imageCard}>
              <Image 
                src={product.image} 
                alt={product.name} 
                fill
                className={styles.image} 
              />
            </div>
            <div>
              <p className="font-label text-[0.65rem] uppercase tracking-widest text-on-surface-variant font-bold mb-2">
                Selected Product
              </p>
              <h3 className="font-headline text-3xl font-extrabold tracking-tighter text-on-surface mb-2">
                {product.name}
              </h3>
              <div className={styles.badges}>
                <span className={styles.categoryBadge}>Electronics</span>
                <span className={styles.skuBadge}>SKU: LX-2024-W1</span>
              </div>
            </div>
          </div>
          
          <div className={styles.actionBtns}>
            <button className={styles.iconBtn} onClick={onClose} title="Close Panel">
              <span className="material-symbols-outlined">close</span>
            </button>
            <button className={styles.iconBtn}>
              <span className="material-symbols-outlined">edit</span>
            </button>
            <button className={`${styles.iconBtn} ${styles.iconBtnDanger}`}>
              <span className="material-symbols-outlined">delete</span>
            </button>
            <button 
              className={`${styles.primaryBtn} font-bold font-headline transition-colors ${!isSaved ? 'bg-indigo-600' : 'bg-slate-300 text-slate-500 cursor-not-allowed'}`}
              onClick={handleUpdateStore}
              disabled={isSaved}
            >
              Update Inventory
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className={styles.statsGrid}>
          <div className="glass-card rounded-2xl p-6 border border-white/60">
            <p className="text-[0.65rem] uppercase tracking-widest text-slate-500 font-semibold mb-2">Current Price</p>
            <p className="text-3xl font-headline font-bold text-slate-800">$299.00</p>
          </div>
          <div className="glass-card rounded-2xl p-6 border border-white/60">
            <p className="text-[0.65rem] uppercase tracking-widest text-slate-500 font-semibold mb-2">Total Units</p>
            <p className="text-3xl font-headline font-bold text-emerald-500">{product.inventory}</p>
          </div>
          <div className="glass-card rounded-2xl p-6 border border-white/60">
            <p className="text-[0.65rem] uppercase tracking-widest text-slate-500 font-semibold mb-2">Category Rank</p>
            <p className="text-3xl font-headline font-bold text-slate-800">#04</p>
          </div>
        </div>

        <div className={styles.detailsGroup}>
          {/* Variants Management */}
          <section className={styles.variantsSection}>
            <div className={styles.sectionHeader}>
              <h4 className="text-base font-bold text-slate-800">Variants</h4>
              <button className={styles.btnOutline} onClick={addVariant}>
                <span className="material-symbols-outlined text-base">add</span> Add variant
              </button>
            </div>
            
            <div className={styles.variantsCard}>
              {/* Options Group */}
              <div className={styles.optionsGroup}>
                <div className={styles.optionRow}>
                  <span className="material-symbols-outlined text-slate-300 text-lg mt-1">drag_indicator</span>
                  <div className={styles.optionContent}>
                    <p className="text-sm font-semibold text-slate-800 mb-2">Size</p>
                    <div className={styles.pillsContainer}>
                      {variants.map(variant => (
                        <span key={variant.id} className={styles.pill}>{variant.name}</span>
                      ))}
                    </div>
                  </div>
                </div>
                <div className={styles.addOptionRow}>
                  <button className={styles.addOptionBtn}>
                    <span className="material-symbols-outlined text-lg">add_circle</span>
                    Add another option
                  </button>
                </div>
              </div>

              {/* Toolbar */}
              <div className={styles.toolbar}>
                <div className={styles.toolbarActions}>
                  <button className={styles.iconBtnSmall}><span className="material-symbols-outlined text-base">search</span></button>
                  <button className={styles.iconBtnSmall}><span className="material-symbols-outlined text-base">filter_list</span></button>
                </div>
              </div>

              {/* Table Header */}
              <div className={styles.tableHeader}>
                <div className={styles.colCheck}><input type="checkbox" className={styles.checkbox} /></div>
                <div className={styles.colVariant}><span className={`text-sm text-slate-600 font-semibold ${styles.textUnderline}`}>Variant</span></div>
                <div className={styles.colPrice}><span className={`text-sm text-slate-600 font-semibold ${styles.textUnderline}`}>Price</span></div>
                <div className={styles.colAvail}><span className={`text-sm text-slate-600 font-semibold ${styles.textUnderline}`}>Available</span></div>
                <div className={styles.colAction}></div>
              </div>

              {/* Table List */}
              <div className={styles.tableList}>
                {variants.map(variant => (
                  <div key={variant.id} className={styles.tableRow}>
                    <div className={styles.colCheck}><input type="checkbox" className={styles.checkbox} /></div>
                    <div className={styles.colVariant}>
                      <div className={styles.imgPlaceholder}>
                        <span className={`material-symbols-outlined ${styles.themeIcon} text-lg`}>add_photo_alternate</span>
                      </div>
                      <input 
                        type="text" 
                        value={variant.name}
                        onChange={(e) => updateVariantField(variant.id, 'name', e.target.value)}
                        className={styles.inputFieldVariantName}
                      />
                    </div>
                    <div className={styles.colPrice}>
                      <div className={styles.inputWrapper}>
                        <span className={styles.inputPrefix}>$</span>
                        <input 
                          type="text" 
                          value={variant.price || "0.00"} 
                          onChange={(e) => updateVariantField(variant.id, 'price', e.target.value)}
                          className={styles.inputField} 
                        />
                      </div>
                    </div>
                    <div className={styles.colAvail}>
                      <input 
                        type="number" 
                        value={variant.available} 
                        onChange={(e) => updateVariantField(variant.id, 'available', parseInt(e.target.value) || 0)}
                        className={styles.inputFieldAvail} 
                      />
                    </div>
                    <div className={styles.colAction}>
                      <button onClick={() => removeVariant(variant.id)} className={styles.removeBtn} title="Remove variant">
                        <span className="material-symbols-outlined text-lg">delete</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Footer */}
              <div className={styles.variantsFooter}>
                <p className="text-sm text-slate-700 font-body">Total inventory at Strands Co: {product.inventory} available</p>
              </div>
            </div>
          </section>

          {/* Narrative */}
          <section className="glass-card rounded-2xl p-8 border border-white/60">
            <h4 className="text-sm font-bold uppercase tracking-widest text-on-surface-variant mb-4">Product Narrative</h4>
            <p className="text-base text-on-surface-variant leading-relaxed font-body">
              The Lumix Pro Wireless headphones define the next generation of acoustic engineering. Featuring active noise cancellation and a refined silver-matte finish, these units are currently our best-sellers in the audio hardware category. Performance and aesthetic excellence combined.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
