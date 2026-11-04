// Popolnoma prevedi ta imenski prostor (slovenščina + angleščina).
// Ključi naj pokrivajo vse uporabniku vidne nize na pripadajoči strani.
export const productsSl = {
  // Glava strani
  title: "Izdelki",
  titleAccent: "v trgovini",
  subtitle: "Upravljajte zalogo svoje trgovine",
  addProduct: "Dodaj izdelek",

  // Statistika
  totalProducts: "Skupno število izdelkov",
  inStock: "Na zalogi",
  lowStock: "Nizka zaloga",
  outOfStock: "Ni na zalogi",

  // Tabela izdelkov
  allProducts: "Vsi izdelki",
  allProductsDesc: "Upravljajte zalogo izdelkov",
  noProductsFound: "Ni najdenih izdelkov.",
  addFirstProduct: "Dodajte prvi izdelek",
  colProduct: "Izdelek",
  colCategory: "Kategorija",
  colSku: "SKU",
  colPrice: "Cena",
  colStock: "Zaloga",
  colStatus: "Status",
  colActions: "Dejanja",
  uncategorized: "Brez kategorije",
  activeBadge: "Aktiven",
  inactiveBadge: "Neaktiven",

  // #78: filtri, sortiranje, paginacija
  filterAll: "Vsi",
  filterLow: "Nizka zaloga",
  filterOut: "Brez zaloge",
  filterInactive: "Neaktivni",
  filterCategory: "Kategorija",
  filterAllCategories: "Vse kategorije",
  sortBy: "Razvrsti",
  sortNewest: "Najnovejši",
  sortName: "Ime (A–Ž)",
  sortPrice: "Cena (naraščajoče)",
  sortStock: "Zaloga (naraščajoče)",
  pageInfo: (page: number, totalPages: number) => `Stran ${page} od ${totalPages}`,
  prevPage: "Prejšnja",
  nextPage: "Naslednja",
  totalProductsCount: (n: number) => `${n} izdelkov`,

  // #78: prejem blaga + inventura (ukazi v glavi tabele)
  receiveDelivery: "Prejem blaga",
  stocktakeLink: "Inventura",

  // #78: obrazec — maloprodajni sloj
  barcodeLabel: "Črtna koda (EAN)",
  barcodePlaceholder: "npr. 3838900000001",
  brandLabel: "Znamka",
  brandPlaceholder: "npr. Keune",
  unitLabel: "Enota",
  unitPlaceholder: "kos",
  vatRateLabel: "DDV stopnja (%)",
  vatRateHelp: "Cene so bruto (DDV vključen); stopnja pove, katera je znotraj. Prazno = 22 %.",
  forSaleLabel: "Za prodajo",
  forSaleDesc: "Izključeno — notranja uporaba (back-bar) se ne prodaja na strani",
  reorderPointLabel: "Prag nizke zaloge",
  reorderPointHelp: "Ob tem številu se izdelek obarva kot nizka zaloga. Prazno = privzeto podjetja.",

  // Iskanje
  searchPlaceholder: "Iskanje izdelkov …",

  // Glavi strani za novo / urejanje
  newTitle: "Nov izdelek",
  newSubtitle: "Dodajte nov izdelek v svojo trgovino",
  editTitle: "Uredi izdelek",

  // Obrazec: kartica podatkov o izdelku
  productInfoTitle: "Podatki o izdelku",
  productInfoDesc: "Osnovni podatki o izdelku",
  nameLabel: "Ime izdelka *",
  namePlaceholder: "npr. Profesionalni šampon",
  descriptionLabel: "Opis",
  descriptionPlaceholder: "Opišite izdelek …",
  categoryLabel: "Kategorija",
  categoryPlaceholder: "Izberite kategorijo",
  // P3 #52: prazno stanje izbirnika — razlaga + pot do prve kategorije
  noCategories: "Ni kategorij. Ustvarite prvo, da lahko razvrstite izdelke.",
  createCategory: "Ustvari kategorijo",
  newCategoryLabel: "Ime nove kategorije",
  newCategoryPlaceholder: "npr. Medi",
  categoryCreated: "Kategorija ustvarjena",
  categoryCreateFailed: "Ustvarjanje kategorije ni uspelo",

  // Obrazec: kartica cen
  pricingTitle: "Cene",
  pricingDesc: "Nastavite ceno izdelka",
  priceLabel: "Cena (€) *",
  compareAtPriceLabel: "Primerjalna cena (€)",
  compareAtPriceHelp: "Izvirna cena za prikaz popusta",

  // Obrazec: kartica zaloge
  inventoryTitle: "Zaloga",
  inventoryDesc: "Upravljajte stanje zaloge",
  skuLabel: "SKU",
  stockQuantityLabel: "Količina na zalogi",
  trackInventoryLabel: "Sledenje zalogi",
  trackInventoryDesc: "Omogočite sledenje zalogi za ta izdelek",

  // #78: prejem blaga (dialog)
  deliveryTitle: "Prejem blaga",
  deliveryDesc: "Zabeležite prejeto dobavo kot en dogodek — vsaka linija dobi premik z virom „Dobava“.",
  deliveryDocumentLabel: "Številka dobavnice",
  deliveryDocumentPlaceholder: "npr. DDV-2026-014",
  deliverySupplierLabel: "Dobavitelj (opcijsko)",
  deliveryProductLabel: "Izdelek",
  deliveryQtyLabel: "Količina",
  deliveryAddLine: "Dodaj linijo",
  deliveryRemoveLine: "Odstrani",
  deliverySubmit: "Zabeleži prejem",
  deliverySuccess: (n: number) => `Prejeto: ${n} linij zabeleženih kot dobava`,
  deliveryFailed: "Prejem blaga ni uspel",
  deliveryNoProducts: "Ni sledenih izdelkov — dodajte izdelek s sledenjem zaloge.",

  // #78: inventura
  stocktakeTitle: "Inventura",
  stocktakeSubtitle: "Vnesite prešteto stanje — razlike se zapišejo kot premiki z virom „Inventura“, samo neničelne.",
  stocktakeSystemLabel: "Sistem",
  stocktakeCountedLabel: "Prešteto",
  stocktakeDeltaLabel: "Razlika",
  stocktakeNoteLabel: "Opomba (opcijsko)",
  stocktakeSubmit: "Zapiši razlike",
  stocktakeSuccess: (n: number) => `Inventura zapisana: ${n} popravkov`,
  stocktakeNoDeltas: "Ni razlik — vse se ujema.",
  stocktakeEmpty: "Ni sledenih izdelkov za štetje.",
  stocktakePrint: "Natisni seznam",

  // Obrazec: kartica slik
  imagesTitle: "Slike izdelka",
  imagesDesc: "Naložite fotografije izdelka",
  imageAlt: (n: number) => `Slika izdelka ${n}`,
  addMoreImages: "Dodaj več slik",
  clickToUpload: "Kliknite za nalaganje slik",

  // Obrazec: kartica stanja
  statusTitle: "Status",
  activeLabel: "Aktiven",
  activeDesc: "Izdelek je na voljo za nakup",
  featuredLabel: "Izpostavljeno",
  featuredDesc: "Prikaži v izpostavljenem razdelku",

  // Dejanja obrazca
  updateButton: "Posodobi izdelek",
  createButton: "Ustvari izdelek",
  deleteButton: "Izbriši izdelek",

  // Sporočila (obvestila / potrditvena okna)
  imageTypeError: "Izberite slikovno datoteko",
  imageSizeError: "Slika mora biti manjša od 5 MB",
  imageUploadSuccess: "Slika je uspešno naložena",
  imageUploadFailed: "Napaka pri nalaganju slike",
  uploadFailed: "Nalaganje ni uspelo",
  deleteConfirm:
    "Ste prepričani, da želite izbrisati ta izdelek? Dejanja ni mogoče razveljaviti.",
  deleteConfirmWithName: (name: string) =>
    `Ste prepričani, da želite izbrisati "${name}"? Dejanja ni mogoče razveljaviti.`,
  deleteSuccess: "Izdelek je uspešno izbrisan",
  deleteFailed: "Napaka pri brisanju izdelka",
  createSuccess: "Izdelek je uspešno ustvarjen",
  createFailed: "Napaka pri ustvarjanju izdelka",
  updateSuccess: "Izdelek je uspešno posodobljen",
  updateFailed: "Napaka pri posodabljanju izdelka",
  unexpectedError: "Prišlo je do nepričakovane napake",
}

export type ProductsDict = typeof productsSl

export const productsEn: ProductsDict = {
  // Page header
  title: "Shop",
  titleAccent: "Products",
  subtitle: "Manage your shop inventory",
  addProduct: "Add Product",

  // Stats
  totalProducts: "Total Products",
  inStock: "In Stock",
  lowStock: "Low Stock",
  outOfStock: "Out of Stock",

  // Products table
  allProducts: "All Products",
  allProductsDesc: "Manage your product inventory",
  noProductsFound: "No products found.",
  addFirstProduct: "Add First Product",
  colProduct: "Product",
  colCategory: "Category",
  colSku: "SKU",
  colPrice: "Price",
  colStock: "Stock",
  colStatus: "Status",
  colActions: "Actions",
  uncategorized: "Uncategorized",
  activeBadge: "Active",
  inactiveBadge: "Inactive",

  // #78: filters, sorting, pagination
  filterAll: "All",
  filterLow: "Low stock",
  filterOut: "Out of stock",
  filterInactive: "Inactive",
  filterCategory: "Category",
  filterAllCategories: "All categories",
  sortBy: "Sort",
  sortNewest: "Newest",
  sortName: "Name (A–Z)",
  sortPrice: "Price (ascending)",
  sortStock: "Stock (ascending)",
  pageInfo: (page: number, totalPages: number) => `Page ${page} of ${totalPages}`,
  prevPage: "Previous",
  nextPage: "Next",
  totalProductsCount: (n: number) => `${n} products`,

  // #78: delivery + stock take (table header actions)
  receiveDelivery: "Record a delivery",
  stocktakeLink: "Stock take",

  // #78: form — retail layer
  barcodeLabel: "Barcode (EAN)",
  barcodePlaceholder: "e.g. 3838900000001",
  brandLabel: "Brand",
  brandPlaceholder: "e.g. Keune",
  unitLabel: "Unit",
  unitPlaceholder: "pcs",
  vatRateLabel: "VAT rate (%)",
  vatRateHelp: "Prices are gross (VAT included); the rate states which one is inside. Empty = 22%.",
  forSaleLabel: "For sale",
  forSaleDesc: "Off — internal use (back-bar), not sellable on the site",
  reorderPointLabel: "Low-stock threshold",
  reorderPointHelp: "At this count the product shows as low stock. Empty = business default.",

  // Search
  searchPlaceholder: "Search products by name, SKU...",

  // New / edit page headers
  newTitle: "New Product",
  newSubtitle: "Add a new product to your shop",
  editTitle: "Edit Product",

  // Form: product information card
  productInfoTitle: "Product Information",
  productInfoDesc: "Basic details about the product",
  nameLabel: "Product Name *",
  namePlaceholder: "e.g., Professional Shampoo",
  descriptionLabel: "Description",
  descriptionPlaceholder: "Describe the product...",
  categoryLabel: "Category",
  categoryPlaceholder: "Select a category",
  // P3 #52: empty state of the picker — explanation + path to the first one
  noCategories: "No categories yet. Create the first one to classify products.",
  createCategory: "Create category",
  newCategoryLabel: "New category name",
  newCategoryPlaceholder: "e.g. Honey",
  categoryCreated: "Category created",
  categoryCreateFailed: "Creating the category failed",

  // Form: pricing card
  pricingTitle: "Pricing",
  pricingDesc: "Set the product price",
  priceLabel: "Price (€) *",
  compareAtPriceLabel: "Compare at Price (€)",
  compareAtPriceHelp: "Original price for showing discount",

  // Form: inventory card
  inventoryTitle: "Inventory",
  inventoryDesc: "Manage stock levels",
  skuLabel: "SKU",
  stockQuantityLabel: "Stock Quantity",
  trackInventoryLabel: "Track Inventory",
  trackInventoryDesc: "Enable stock tracking for this product",

  // #78: delivery (dialog)
  deliveryTitle: "Record a delivery",
  deliveryDesc: "Log the received goods as ONE event — every line gets a movement with the “Delivery” source.",
  deliveryDocumentLabel: "Delivery note number",
  deliveryDocumentPlaceholder: "e.g. DN-2026-014",
  deliverySupplierLabel: "Supplier (optional)",
  deliveryProductLabel: "Product",
  deliveryQtyLabel: "Quantity",
  deliveryAddLine: "Add line",
  deliveryRemoveLine: "Remove",
  deliverySubmit: "Record delivery",
  deliverySuccess: (n: number) => `Received: ${n} lines recorded as a delivery`,
  deliveryFailed: "Recording the delivery failed",
  deliveryNoProducts: "No tracked products — add a product with stock tracking first.",

  // #78: stock take
  stocktakeTitle: "Stock take",
  stocktakeSubtitle: "Enter the counted quantities — deltas are written as “Stock take” movements, non-zero ones only.",
  stocktakeSystemLabel: "System",
  stocktakeCountedLabel: "Counted",
  stocktakeDeltaLabel: "Delta",
  stocktakeNoteLabel: "Note (optional)",
  stocktakeSubmit: "Write deltas",
  stocktakeSuccess: (n: number) => `Stock take recorded: ${n} adjustments`,
  stocktakeNoDeltas: "No deltas — everything matches.",
  stocktakeEmpty: "No tracked products to count.",
  stocktakePrint: "Print list",

  // Form: images card
  imagesTitle: "Product Images",
  imagesDesc: "Upload product photos",
  imageAlt: (n: number) => `Product image ${n}`,
  addMoreImages: "Add more images",
  clickToUpload: "Click to upload images",

  // Form: status card
  statusTitle: "Status",
  activeLabel: "Active",
  activeDesc: "Product is available for purchase",
  featuredLabel: "Featured",
  featuredDesc: "Show in featured section",

  // Form actions
  updateButton: "Update Product",
  createButton: "Create Product",
  deleteButton: "Delete Product",

  // Messages (toasts / dialogs)
  imageTypeError: "Please select an image file",
  imageSizeError: "Image must be less than 5MB",
  imageUploadSuccess: "Image uploaded successfully",
  imageUploadFailed: "Failed to upload image",
  uploadFailed: "Upload failed",
  deleteConfirm:
    "Are you sure you want to delete this product? This action cannot be undone.",
  deleteConfirmWithName: (name: string) =>
    `Are you sure you want to delete "${name}"? This action cannot be undone.`,
  deleteSuccess: "Product deleted successfully",
  deleteFailed: "Failed to delete product",
  createSuccess: "Product created successfully",
  createFailed: "Failed to create product",
  updateSuccess: "Product updated successfully",
  updateFailed: "Failed to update product",
  unexpectedError: "An unexpected error occurred",
}
