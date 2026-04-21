"use client";

import Link from 'next/link';
import { useEffect, useState, useMemo } from 'react';
import { useCart } from '../../context/CartContext';
import CartDrawer from '../../components/storefront/CartDrawer';

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
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,300;1,400&family=DM+Sans:wght@300;400;500&display=swap');
        *, *::before, *::after { box-sizing:border-box;margin:0;padding:0; }
        .shop { background:#080808;min-height:100vh;color:#f2ede4;font-family:'DM Sans',sans-serif; }
        .shop-nav { display:flex;align-items:center;justify-content:space-between;padding:24px 48px;border-bottom:1px solid #1e1c19;position:sticky;top:0;background:#080808;z-index:50; }
        .nav-logo { font-family:'Cormorant Garamond',serif;font-size:20px;font-weight:500;letter-spacing:0.12em;text-transform:uppercase;color:#f2ede4;text-decoration:none; }
        .nav-right { display:flex;align-items:center;gap:32px; }
        .nav-link { color:#6a6058;text-decoration:none;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;transition:color 0.2s; }
        .nav-link:hover { color:#f2ede4; }
        .cart-btn { background:none;border:1px solid #2e2b26;color:#f2ede4;padding:10px 20px;font-size:12px;letter-spacing:0.1em;text-transform:uppercase;cursor:pointer;transition:border-color 0.2s,background 0.2s;display:flex;align-items:center;gap:8px; }
        .cart-btn:hover { border-color:#c9a86c;background:rgba(201,168,108,0.05); }
        .cart-count { background:#c9a86c;color:#080808;font-size:10px;font-weight:700;width:18px;height:18px;border-radius:50%;display:flex;align-items:center;justify-content:center; }
        .shop-header { padding:64px 48px 48px;border-bottom:1px solid #1e1c19; }
        .page-eyebrow { font-size:11px;letter-spacing:0.3em;text-transform:uppercase;color:#4a4540;margin-bottom:12px; }
        .page-title { font-family:'Cormorant Garamond',serif;font-size:56px;font-weight:300;color:#f2ede4; }
        .shop-toolbar { display:flex;align-items:center;justify-content:space-between;padding:20px 48px;border-bottom:1px solid #1e1c19; }
        .search-wrap { position:relative; }
        .search-input { background:#0f0e0c;border:1px solid #1e1c19;color:#f2ede4;padding:10px 16px 10px 40px;font-size:13px;font-family:'DM Sans',sans-serif;width:280px;outline:none;transition:border-color 0.2s; }
        .search-input::placeholder { color:#3a3830; }
        .search-input:focus { border-color:#2e2b26; }
        .search-icon { position:absolute;left:14px;top:50%;transform:translateY(-50%);color:#3a3830;font-size:14px; }
        .result-count { font-size:12px;color:#4a4540;letter-spacing:0.05em; }
        .shop-grid { display:grid;grid-template-columns:repeat(4,1fr);gap:1px;padding:1px;background:#1a1916; }
        .p-card { background:#080808;display:block;text-decoration:none;color:inherit;position:relative;overflow:hidden; }
        .p-card:hover .p-img-inner { transform:scale(1.04); }
        .p-card:hover .p-actions { opacity:1;transform:translateY(0); }
        .p-img { aspect-ratio:1;overflow:hidden;background:#0f0e0c;position:relative; }
        .p-img-inner { width:100%;height:100%;transition:transform 0.5s cubic-bezier(0.25,0.46,0.45,0.94); }
        .p-img img { width:100%;height:100%;object-fit:cover; }
        .p-placeholder { width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-family:'Cormorant Garamond',serif;font-size:48px;color:#1e1c19; }
        .p-actions { position:absolute;bottom:0;left:0;right:0;padding:16px;background:linear-gradient(to top,rgba(8,8,8,0.95),transparent);opacity:0;transform:translateY(8px);transition:opacity 0.25s,transform 0.25s; }
        .add-btn { width:100%;padding:12px;background:#c9a86c;border:none;color:#080808;font-size:11px;font-weight:500;letter-spacing:0.15em;text-transform:uppercase;cursor:pointer;transition:background 0.15s; }
        .add-btn:hover { background:#dbb97e; }
        .add-btn.added { background:#2e4a2e;color:#a0d4a0; }
        .p-body { padding:20px; }
        .p-vendor { font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:#4a4540;margin-bottom:6px; }
        .p-title { font-family:'Cormorant Garamond',serif;font-size:20px;font-weight:400;color:#f2ede4;margin-bottom:8px;line-height:1.2; }
        .p-footer { display:flex;align-items:center;justify-content:space-between; }
        .p-price { font-size:14px;color:#c9a86c;font-weight:300; }
        .p-compare { font-size:12px;color:#3a3830;text-decoration:line-through; }
        .empty-state { padding:120px 48px;text-align:center; }
        .empty-icon { font-family:'Cormorant Garamond',serif;font-size:80px;color:#1e1c19;margin-bottom:24px; }
        .empty-msg { font-size:14px;color:#4a4540;letter-spacing:0.05em; }
        .skeleton-grid { display:grid;grid-template-columns:repeat(4,1fr);gap:1px;padding:1px;background:#1a1916; }
        .skeleton-card { background:#080808; }
        .skeleton-img { aspect-ratio:1;background:#0f0e0c;animation:shimmer 1.5s infinite; }
        .skeleton-body { padding:20px; }
        .skeleton-line { height:10px;background:#0f0e0c;border-radius:2px;margin-bottom:10px;animation:shimmer 1.5s infinite; }
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
