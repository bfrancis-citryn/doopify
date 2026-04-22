"use client";

import Link from 'next/link';
import { useEffect, useState, useMemo } from 'react';
import { useCart } from '@/context/CartContext';
import CartDrawer from '@/components/storefront/CartDrawer';

export default function ShopPage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [added, setAdded] = useState({});
  const { addItem, count, openCart } = useCart();

  useEffect(() => {
    fetch('/api/storefront/products?pageSize=50')
      .then(r => r.json())
      .then(json => { if (json.success) setProducts(json.data.products || []); })
      .finally(() => setLoading(false));
  }, []);

  const visible = useMemo(() => {
    if (!search.trim()) return products;
    const q = search.toLowerCase();
    return products.filter(p =>
      p.title.toLowerCase().includes(q) ||
      (p.vendor || '').toLowerCase().includes(q) ||
      (p.description || '').toLowerCase().includes(q)
    );
  }, [products, search]);

  const handleAddToCart = (e, product) => {
    e.preventDefault();
    const variant = product.variants?.[0];
    if (!variant) return;
    const variantTitle =
      variant.title && !['Default', 'Default Title'].includes(variant.title) ? variant.title : undefined;
    addItem({
      variantId: variant.id,
      productId: product.id,
      title: product.title,
      variantTitle,
      price: variant.price,
      image: product.media?.[0]?.asset?.url || null,
    });
    setAdded(prev => ({ ...prev, [product.id]: true }));
    setTimeout(() => setAdded(prev => ({ ...prev, [product.id]: false })), 1800);
  };

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing:border-box;margin:0;padding:0; }
        .shop { background:#080808;min-height:100vh;color:#f2ede4;font-family:var(--font-body),sans-serif; }
        .shop-nav { display:flex;align-items:center;justify-content:space-between;padding:24px 48px;border-bottom:1px solid rgba(255,255,255,0.08);position:sticky;top:0;background:rgba(8,8,8,0.72);backdrop-filter:blur(20px) saturate(120%);-webkit-backdrop-filter:blur(20px) saturate(120%);z-index:50; }
        .nav-logo { font-family:var(--font-headline),sans-serif;font-size:20px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#f2ede4;text-decoration:none; }
        .nav-right { display:flex;align-items:center;gap:32px; }
        .nav-link { color:#6a6058;text-decoration:none;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;transition:color 0.2s; }
        .nav-link:hover { color:#f2ede4; }
        .cart-btn { background:linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03)),rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.12);border-radius:999px;color:#f5f5f5;padding:10px 18px;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;cursor:pointer;transition:border-color 0.2s,background 0.2s,transform 0.2s;display:flex;align-items:center;gap:8px;backdrop-filter:blur(18px) saturate(120%);-webkit-backdrop-filter:blur(18px) saturate(120%);box-shadow:inset 0 1px 0 rgba(255,255,255,0.08),0 18px 30px rgba(0,0,0,0.18); }
        .cart-btn:hover { transform:translateY(-2px);border-color:rgba(255,255,255,0.2);background:linear-gradient(180deg,rgba(255,255,255,0.12),rgba(255,255,255,0.04)),rgba(255,255,255,0.06); }
        .cart-count { background:#f5f5f5;color:#080808;font-size:10px;font-weight:700;width:18px;height:18px;border-radius:50%;display:flex;align-items:center;justify-content:center; }
        .shop-header { padding:64px 48px 48px;border-bottom:1px solid rgba(255,255,255,0.08); }
        .page-eyebrow { font-size:11px;letter-spacing:0.3em;text-transform:uppercase;color:#4a4540;margin-bottom:12px; }
        .page-title { font-family:var(--font-headline),sans-serif;font-size:52px;font-weight:700;letter-spacing:-0.05em;color:#f2ede4; }
        .shop-toolbar { display:flex;align-items:center;justify-content:space-between;padding:20px 48px;border-bottom:1px solid rgba(255,255,255,0.08); }
        .search-wrap { position:relative; }
        .search-input { background:linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03)),rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:999px;color:#f2ede4;padding:12px 18px 12px 42px;font-size:13px;font-family:var(--font-body),sans-serif;width:280px;outline:none;transition:border-color 0.2s,background 0.2s;backdrop-filter:blur(18px) saturate(120%);-webkit-backdrop-filter:blur(18px) saturate(120%); }
        .search-input::placeholder { color:rgba(255,255,255,0.28); }
        .search-input:focus { border-color:rgba(255,255,255,0.2);background:linear-gradient(180deg,rgba(255,255,255,0.1),rgba(255,255,255,0.04)),rgba(255,255,255,0.05); }
        .search-icon { position:absolute;left:16px;top:50%;transform:translateY(-50%);color:rgba(255,255,255,0.36);font-size:14px; }
        .result-count { font-size:12px;color:rgba(255,255,255,0.4);letter-spacing:0.05em; }
        .shop-grid { display:grid;grid-template-columns:repeat(4,1fr);gap:24px;padding:32px 48px 80px; }
        .p-card { display:block;text-decoration:none;color:inherit;position:relative;padding:12px;border-radius:24px;border:1px solid rgba(255,255,255,0.1);background:linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03)),rgba(255,255,255,0.04);backdrop-filter:blur(24px) saturate(125%);-webkit-backdrop-filter:blur(24px) saturate(125%);box-shadow:inset 0 1px 0 rgba(255,255,255,0.08),0 28px 56px rgba(0,0,0,0.22);overflow:hidden;transition:transform 0.3s ease,border-color 0.3s ease,box-shadow 0.3s ease; }
        .p-card:hover .p-img-inner { transform:scale(1.03); }
        .p-card:hover { transform:translateY(-6px);border-color:rgba(255,255,255,0.18);box-shadow:inset 0 1px 0 rgba(255,255,255,0.12),0 34px 70px rgba(0,0,0,0.28); }
        .p-card::before { content:'';position:absolute;inset:0;pointer-events:none;background:radial-gradient(circle at 0% 0%,rgba(255,255,255,0.16),transparent 26%),linear-gradient(180deg,rgba(255,255,255,0.06),transparent 24%);opacity:0.8; }
        .p-img { aspect-ratio:1;overflow:hidden;border-radius:18px;border:1px solid rgba(255,255,255,0.08);background:linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.015)),rgba(7,7,7,0.56);position:relative; }
        .p-img-inner { width:100%;height:100%;transition:transform 0.5s cubic-bezier(0.25,0.46,0.45,0.94); }
        .p-img img { width:100%;height:100%;object-fit:cover; }
        .p-placeholder { width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-family:var(--font-headline),sans-serif;font-size:48px;font-weight:700;color:rgba(255,255,255,0.16); }
        .p-actions { position:absolute;left:12px;right:12px;bottom:12px;padding:0;opacity:1;transform:none;transition:transform 0.25s,opacity 0.25s; }
        .add-btn { width:100%;min-height:44px;padding:0 16px;background:linear-gradient(180deg,rgba(255,255,255,0.12),rgba(255,255,255,0.04)),rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.16);border-radius:999px;color:#ffffff;font-size:11px;font-weight:500;letter-spacing:0.15em;text-transform:uppercase;cursor:pointer;transition:background 0.2s,border-color 0.2s,transform 0.2s;backdrop-filter:blur(18px) saturate(120%);-webkit-backdrop-filter:blur(18px) saturate(120%);box-shadow:0 16px 30px rgba(0,0,0,0.2); }
        .add-btn:hover { transform:translateY(-1px);border-color:rgba(255,255,255,0.22);background:linear-gradient(180deg,rgba(255,255,255,0.16),rgba(255,255,255,0.05)),rgba(255,255,255,0.08); }
        .add-btn.added { border-color:rgba(255,255,255,0.28);background:linear-gradient(180deg,rgba(255,255,255,0.2),rgba(255,255,255,0.06)),rgba(255,255,255,0.1);color:#ffffff; }
        .p-body { position:relative;z-index:1;padding:18px 8px 8px; }
        .p-vendor { font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:rgba(255,255,255,0.38);margin-bottom:10px; }
        .p-title { font-family:var(--font-headline),sans-serif;font-size:19px;font-weight:700;letter-spacing:-0.03em;color:#f8f8f8;margin-bottom:14px;line-height:1.2; }
        .p-footer { display:flex;align-items:center;justify-content:space-between; }
        .p-price { font-size:14px;color:rgba(255,255,255,0.92);font-weight:500; }
        .p-compare { font-size:12px;color:rgba(255,255,255,0.28);text-decoration:line-through; }
        .empty-state { padding:120px 48px;text-align:center; }
        .empty-icon { font-family:var(--font-headline),sans-serif;font-size:80px;font-weight:700;color:rgba(255,255,255,0.16);margin-bottom:24px; }
        .empty-msg { font-size:14px;color:rgba(255,255,255,0.4);letter-spacing:0.05em; }
        .skeleton-grid { display:grid;grid-template-columns:repeat(4,1fr);gap:24px;padding:32px 48px 80px; }
        .skeleton-card { padding:12px;border-radius:24px;border:1px solid rgba(255,255,255,0.08);background:linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02)),rgba(255,255,255,0.03);overflow:hidden; }
        .skeleton-img { aspect-ratio:1;border-radius:18px;background:rgba(255,255,255,0.05);animation:shimmer 1.5s infinite; }
        .skeleton-body { padding:20px; }
        .skeleton-line { height:10px;background:rgba(255,255,255,0.06);border-radius:999px;margin-bottom:10px;animation:shimmer 1.5s infinite; }
        .skeleton-line.short { width:40%; }
        @keyframes shimmer { 0%,100%{opacity:1}50%{opacity:0.4} }
        @media (max-width:1100px) { .shop-grid,.skeleton-grid { grid-template-columns:repeat(3,1fr); } }
        @media (max-width:768px) {
          .shop-nav,.shop-header,.shop-toolbar { padding-left:24px;padding-right:24px; }
          .shop-grid,.skeleton-grid { grid-template-columns:repeat(2,1fr); }
          .search-input { width:200px; }
        }
        @media (max-width:480px) { .shop-grid,.skeleton-grid { grid-template-columns:1fr; } }
      `}</style>

      <CartDrawer />

      <div className="shop">
        <nav className="shop-nav">
          <Link className="nav-logo" href="/">Doopify</Link>
          <div className="nav-right">
            <Link className="nav-link" href="/">Home</Link>
            <button className="cart-btn" onClick={openCart}>
              Bag
              {count > 0 && <span className="cart-count">{count}</span>}
            </button>
          </div>
        </nav>

        <header className="shop-header">
          <p className="page-eyebrow">All products</p>
          <h1 className="page-title">The Collection</h1>
        </header>

        <div className="shop-toolbar">
          <div className="search-wrap">
            <span className="search-icon">⌕</span>
            <input
              className="search-input"
              onChange={e => setSearch(e.target.value)}
              placeholder="Search products..."
              type="text"
              value={search}
            />
          </div>
          <span className="result-count">
            {loading ? '—' : `${visible.length} product${visible.length !== 1 ? 's' : ''}`}
          </span>
        </div>

        {loading ? (
          <div className="skeleton-grid">
            {Array.from({ length: 8 }).map((_, i) => (
              <div className="skeleton-card" key={i}>
                <div className="skeleton-img" />
                <div className="skeleton-body">
                  <div className="skeleton-line short" />
                  <div className="skeleton-line" />
                  <div className="skeleton-line short" />
                </div>
              </div>
            ))}
          </div>
        ) : visible.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">✦</div>
            <p className="empty-msg">No products found</p>
          </div>
        ) : (
          <div className="shop-grid">
            {visible.map(product => {
              const variant = product.variants?.[0];
              const image = product.media?.[0]?.asset?.url;
              const isAdded = added[product.id];
              return (
                <Link className="p-card" href={`/shop/${product.handle}`} key={product.id}>
                  <div className="p-img">
                    <div className="p-img-inner">
                      {image
                        ? <img alt={product.title} src={image} />
                        : <div className="p-placeholder">✦</div>
                      }
                    </div>
                    <div className="p-actions">
                      <button
                        className={`add-btn${isAdded ? ' added' : ''}`}
                        onClick={e => handleAddToCart(e, product)}
                        type="button"
                      >
                        {isAdded ? '✓ Added' : 'Add to Bag'}
                      </button>
                    </div>
                  </div>
                  <div className="p-body">
                    {product.vendor && <p className="p-vendor">{product.vendor}</p>}
                    <h2 className="p-title">{product.title}</h2>
                    <div className="p-footer">
                      {variant && (
                        <span className="p-price">${Number(variant.price).toFixed(2)}</span>
                      )}
                      {variant?.compareAtPrice && Number(variant.compareAtPrice) > Number(variant.price) && (
                        <span className="p-compare">${Number(variant.compareAtPrice).toFixed(2)}</span>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
