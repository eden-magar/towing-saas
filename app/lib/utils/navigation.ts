export const openWaze = (address: string) => {
  const encoded = encodeURIComponent(address)
  const wazeAppUrl = `waze://?q=${encoded}&navigate=yes`
  const wazeWebUrl = `https://waze.com/ul?q=${encoded}&navigate=yes`
  
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
  
  if (isMobile) {
    // בניסיון לפתוח את האפליקציה
    window.location.href = wazeAppUrl
    // fallback לדפדפן אם האפליקציה לא נפתחה
    setTimeout(() => {
      window.open(wazeWebUrl, '_blank')
    }, 1500)
  } else {
    window.open(wazeWebUrl, '_blank')
  }
}

export const openGoogleMaps = (address: string) => {
  const encoded = encodeURIComponent(address)
  const mapsAppUrl = `comgooglemaps://?daddr=${encoded}&directionsmode=driving`
  const mapsWebUrl = `https://www.google.com/maps/dir/?api=1&destination=${encoded}`
  
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
  
  if (isMobile) {
    window.location.href = mapsAppUrl
    setTimeout(() => {
      window.open(mapsWebUrl, '_blank')
    }, 1500)
  } else {
    window.open(mapsWebUrl, '_blank')
  }
}