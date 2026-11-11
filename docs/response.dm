Report only (no changes). src/pages/ServicesPage.jsx:

(1) useEffect that resets displayCount when search/category/city/verified/sort change:
662:   useEffect(() => { setDisplayCount(pageSizeRef.current) }, [search, activeCat, activeCity, verifiedOnly, sortBy])

(2) Result text:
938:   const n = filtered.length
939:   const resultText = `${n} service${n !== 1 ? 's' : ''}${activeCity !== 'All' ? ` in ${activeCity}` : ''}`
1142:                 <span className="svc-result-text">{resultText}</span>
It uses filtered.length (total matching count), not displayCount.