-- #100 F1 (popravek P2022) — B: polna strukturna sinhronizacija sheme
--
-- Produkcijska baza (Vercel) je nastala z db push + delno apliciranimi
-- migracijami: tabeli/stolpci, dodani v schema.prismo BREZ migracije
-- (Organization.skdCodes v aa6b7e2, OrganizationMember,
-- OrganizationModuleState, WalkInEntry, ...), v njej NE obstajajo →
-- P2021/P2022 ob prvem dostopu.
--
-- Ta migracija je IDEMPOTENTEN full-sync do trenutne sheme (izhod
-- `prisma migrate diff --from-empty --to-schema-datamodel`, pretvorjen v
-- varne oblike): CREATE TABLE IF NOT EXISTS, ADD COLUMN IF NOT EXISTS za
-- vsak stolpec (NOT NULL brez privzetega: DO blok s začasnim DEFAULT in
-- DROP DEFAULT — varen na nepraznih tabelah), CREATE INDEX IF NOT EXISTS,
-- FK prek pg_constraint probe. Objekti, ki že obstajajo, ostanejo
-- nedotaknjeni (nobenega DROP/ALTER TYPE, ničesar ne brise).
-- Enumi so zagotovljeni v predhodni migraciji A (posebna transakcija).

-- ========== 1) TABELE (CREATE TABLE IF NOT EXISTS, polna oblika) ==========
CREATE TABLE IF NOT EXISTS "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,
    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Organization" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "logo" TEXT,
    "vertical" TEXT NOT NULL DEFAULT 'beauty',
    "palette" TEXT NOT NULL DEFAULT 'rose',
    "plan" TEXT NOT NULL DEFAULT 'free',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "suspendedAt" TIMESTAMP(3),
    "suspendedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "profileVersion" TEXT,
    "profileOverrides" JSONB,
    "verticalChosenAt" TIMESTAMP(3),
    "setupChecklist" JSONB,
    "onboardingAnswers" JSONB,
    "secondaryVertical" TEXT,
    "skdCodes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "customTags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "verticalSkipped" BOOLEAN NOT NULL DEFAULT false,
    "publishState" TEXT NOT NULL DEFAULT 'PUBLISHED',
    "publishedAt" TIMESTAMP(3),
    "contentVersion" INTEGER NOT NULL DEFAULT 1,
    "stripeSecretKey" TEXT,
    "stripeWebhookSecret" TEXT,
    "stripeConfiguredAt" TIMESTAMP(3),
    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PlatformSubscription" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "stripePriceId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'INCOMPLETE',
    "plan" TEXT NOT NULL DEFAULT 'free',
    "currentPeriodStart" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "canceledAt" TIMESTAMP(3),
    "pendingCheckoutSessionId" TEXT,
    "pendingPlanId" TEXT,
    "pendingAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PlatformSubscription_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PlatformBillingEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "subscriptionId" TEXT,
    "stripeEventId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amountCents" INTEGER,
    "currency" TEXT,
    "plan" TEXT,
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlatformBillingEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PlatformAuditLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "actorEmail" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "reason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlatformAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PlatformWebhookFailure" (
    "id" TEXT NOT NULL,
    "stripeEventId" TEXT,
    "type" TEXT,
    "reason" TEXT NOT NULL,
    "detail" TEXT,
    "payloadSnippet" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlatformWebhookFailure_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Media" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "data" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Media_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "password" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'CLIENTE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "resetToken" TEXT,
    "resetTokenExpiry" TIMESTAMP(3),
    "organizationId" TEXT,
    "customRoleId" TEXT,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "NotificationPreferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emailReminders" BOOLEAN NOT NULL DEFAULT true,
    "reminderTime" TEXT NOT NULL DEFAULT '24h',
    "promotionalEmails" BOOLEAN NOT NULL DEFAULT false,
    "appointmentUpdates" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "NotificationPreferences_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CustomRole" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "permissions" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CustomRole_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

CREATE TABLE IF NOT EXISTS "SalonConfig" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Beauty Salon',
    "logo" TEXT,
    "organizationId" TEXT,
    "siteContent" JSONB,
    "theme" JSONB,
    "publishedSiteContent" JSONB,
    "publishedContentVersion" INTEGER,
    "primaryColor" TEXT NOT NULL DEFAULT '#000000',
    "secondaryColor" TEXT NOT NULL DEFAULT '#ffffff',
    "accentColor" TEXT NOT NULL DEFAULT '#d4af37',
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "zipCode" TEXT,
    "country" TEXT NOT NULL DEFAULT 'US',
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Ljubljana',
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "locale" TEXT NOT NULL DEFAULT 'sl',
    "bookingDeposit" DECIMAL(10,2) NOT NULL DEFAULT 50.00,
    "depositRefundable" BOOLEAN NOT NULL DEFAULT false,
    "bookingDepositType" "DepositType" NOT NULL DEFAULT 'FIXED',
    "defaultReorderPoint" INTEGER NOT NULL DEFAULT 10,
    "minBookingAdvance" INTEGER NOT NULL DEFAULT 24,
    "maxBookingAdvance" INTEGER NOT NULL DEFAULT 30,
    "cancellationPolicy" TEXT,
    "analyticsMeasurementId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SalonConfig_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "presetSeed" TEXT,
    "organizationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Service" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "presetSeed" TEXT,
    "duration" INTEGER NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "imageUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "depositType" "DepositType" NOT NULL DEFAULT 'INHERIT',
    "depositValue" DECIMAL(10,2),
    "categoryId" TEXT,
    "intakeFormDefinitionId" TEXT,
    "organizationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Service_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Review" (
    "id" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT NOT NULL,
    "serviceId" TEXT,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ServiceGallery" (
    "id" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "caption" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "serviceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ServiceGallery_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ServiceFAQ" (
    "id" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "serviceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ServiceFAQ_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Staff" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "bio" TEXT,
    "image" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "defaultTipPercent" DECIMAL(5,2),
    "commissionType" "CommissionType" NOT NULL DEFAULT 'NONE',
    "commissionValue" DECIMAL(10,2),
    "commissionBasis" TEXT NOT NULL DEFAULT 'service',
    "userId" TEXT NOT NULL,
    "organizationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Staff_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "StaffService" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    CONSTRAINT "StaffService_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "WorkingHours" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "WorkingHours_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Customer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "notes" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "dateOfBirth" TIMESTAMP(3),
    "userId" TEXT,
    "organizationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "WaitlistEntry" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "serviceId" TEXT,
    "preferredDate" TIMESTAMP(3),
    "notes" TEXT,
    "status" "WaitlistStatus" NOT NULL DEFAULT 'WAITING',
    "notifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WaitlistEntry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ServiceAddon" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "durationMin" INTEGER NOT NULL DEFAULT 0,
    "position" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "ServiceAddon_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "MarketingCampaign" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "kind" "CampaignKind" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "thresholdDays" INTEGER NOT NULL DEFAULT 60,
    "tagFilter" TEXT,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "lastRunAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MarketingCampaign_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CampaignSend" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "triggerKey" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CampaignSend_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "WalkInEntry" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "serviceId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'WAITING',
    "ticketCode" TEXT NOT NULL,
    "servedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WalkInEntry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "MarketingUnsubscribe" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "unsubscribedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MarketingUnsubscribe_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PushSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "OrganizationMember" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "customRoleId" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrganizationMember_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "OrganizationModuleState" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OrganizationModuleState_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Appointment" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "customerId" TEXT,
    "guestName" TEXT,
    "guestEmail" TEXT,
    "guestPhone" TEXT,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "status" "AppointmentStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "resourceRecordId" TEXT,
    "totalPrice" DECIMAL(10,2) NOT NULL,
    "depositAmount" DECIMAL(10,2) NOT NULL DEFAULT 50.00,
    "depositPaid" BOOLEAN NOT NULL DEFAULT false,
    "stripePaymentId" TEXT,
    "tipAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "tipMethod" TEXT,
    "commissionAmount" DECIMAL(10,2),
    "addons" JSONB,
    "reminderSentAt" TIMESTAMP(3),
    "confirmationSentAt" TIMESTAMP(3),
    "intakeToken" TEXT,
    "noShowConsent" BOOLEAN NOT NULL DEFAULT false,
    "stripeSetupIntentId" TEXT,
    "stripeCustomerId" TEXT,
    "noShowSetupStatus" TEXT NOT NULL DEFAULT 'NONE',
    "noShowChargeStatus" TEXT NOT NULL DEFAULT 'NONE',
    "noShowChargeId" TEXT,
    "organizationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AppointmentService" (
    "id" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    CONSTRAINT "AppointmentService_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Product" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" DECIMAL(10,2) NOT NULL,
    "compareAtPrice" DECIMAL(10,2),
    "sku" TEXT,
    "trackInventory" BOOLEAN NOT NULL DEFAULT true,
    "stockQuantity" INTEGER NOT NULL DEFAULT 0,
    "barcode" TEXT,
    "brand" TEXT,
    "unit" TEXT NOT NULL DEFAULT 'kos',
    "vatRate" DECIMAL(5,2),
    "forSale" BOOLEAN NOT NULL DEFAULT true,
    "reorderPoint" INTEGER,
    "presetSeed" TEXT,
    "images" TEXT[],
    "categoryId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "organizationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Order" (
    "id" TEXT NOT NULL,
    "customerId" TEXT,
    "guestName" TEXT,
    "guestEmail" TEXT,
    "guestPhone" TEXT,
    "subtotal" DECIMAL(10,2) NOT NULL,
    "tax" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(10,2) NOT NULL,
    "tipAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "tipMethod" TEXT,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "paymentMethod" TEXT NOT NULL DEFAULT 'online',
    "stripePaymentIntentId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "organizationId" TEXT,
    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "OrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "FormDefinition" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "fields" JSONB NOT NULL,
    "sourceProfile" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FormDefinition_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "FormSubmission" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "formDefinitionId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "customerId" TEXT,
    "contextType" TEXT,
    "contextId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FormSubmission_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "WorkflowDefinition" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sourceProfile" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WorkflowDefinition_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "WorkflowStage" (
    "id" TEXT NOT NULL,
    "definitionId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL,
    "slaHours" INTEGER,
    "isFinal" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "WorkflowStage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "WorkOrder" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "workflowDefinitionId" TEXT,
    "currentStageKey" TEXT,
    "dueDate" TIMESTAMP(3),
    "total" DECIMAL(10,2),
    "notes" TEXT,
    "sourceSubmissionId" TEXT,
    "linkedRecordId" TEXT,
    "customerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WorkOrder_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "WorkOrderEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "fromStageKey" TEXT,
    "toStageKey" TEXT,
    "message" TEXT,
    "actorEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkOrderEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ExtensionRecord" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "extensionId" TEXT NOT NULL,
    "entityKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "customerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ExtensionRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ProductVariant" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sku" TEXT,
    "price" DECIMAL(10,2),
    "trackInventory" BOOLEAN NOT NULL DEFAULT true,
    "stockQuantity" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProductVariant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Package" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "kind" "PrepaidKind" NOT NULL DEFAULT 'PACKAGE',
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" DECIMAL(10,2) NOT NULL,
    "compareAtPrice" DECIMAL(10,2),
    "faceValue" DECIMAL(10,2),
    "sessionCount" INTEGER,
    "validityDays" INTEGER,
    "serviceIds" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Package_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PrepaidPurchase" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "prepaidProductId" TEXT NOT NULL,
    "customerId" TEXT,
    "guestEmail" TEXT,
    "code" TEXT NOT NULL,
    "purchasedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "balance" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "sessionsLeft" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "stripeSessionId" TEXT,
    "note" TEXT,
    CONSTRAINT "PrepaidPurchase_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PrepaidRedemption" (
    "id" TEXT NOT NULL,
    "prepaidPurchaseId" TEXT NOT NULL,
    "appointmentId" TEXT,
    "orderId" TEXT,
    "amount" DECIMAL(10,2),
    "sessions" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PrepaidRedemption_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PackageItem" (
    "id" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "itemType" TEXT NOT NULL,
    "serviceId" TEXT,
    "productId" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "position" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "PackageItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Document" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "customerId" TEXT,
    "workOrderId" TEXT,
    "issueDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3),
    "total" DECIMAL(10,2) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "DocumentItem" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "total" DECIMAL(10,2) NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "DocumentItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CustomDomain" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "dnsRecords" JSONB,
    "lastError" TEXT,
    "lastCheckedAt" TIMESTAMP(3),
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CustomDomain_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "StockMovement" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productVariantId" TEXT,
    "direction" "StockDirection" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "source" "StockMovementSource" NOT NULL DEFAULT 'MANUAL',
    "note" TEXT,
    "orderId" TEXT,
    "supplierRecordId" TEXT,
    "batchRecordId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Project" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "ProjectStatus" NOT NULL DEFAULT 'PLANNING',
    "startDate" TIMESTAMP(3),
    "deadline" TIMESTAMP(3),
    "budget" DECIMAL(10,2),
    "notes" TEXT,
    "customerId" TEXT,
    "workOrderId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ProjectTask" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "ProjectTaskStatus" NOT NULL DEFAULT 'OPEN',
    "dueDate" TIMESTAMP(3),
    "assigneeName" TEXT,
    "hoursEst" DOUBLE PRECISION,
    "notes" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProjectTask_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ConfigChangeLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "entityKey" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "actorEmail" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "summary" TEXT,
    "previous" JSONB,
    "next" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ConfigChangeLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "JobRun" (
    "id" TEXT NOT NULL,
    "job" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "ok" BOOLEAN NOT NULL DEFAULT true,
    "sent" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "detail" JSONB,
    CONSTRAINT "JobRun_pkey" PRIMARY KEY ("id")
);

-- ========== 2) STOLPCI (ADD COLUMN IF NOT EXISTS za vsak stolpec) ==========
-- Account
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Account' AND column_name = 'id') THEN
    ALTER TABLE "Account" ADD COLUMN "id" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "Account" ALTER COLUMN "id" DROP DEFAULT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Account' AND column_name = 'userId') THEN
    ALTER TABLE "Account" ADD COLUMN "userId" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "Account" ALTER COLUMN "userId" DROP DEFAULT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Account' AND column_name = 'type') THEN
    ALTER TABLE "Account" ADD COLUMN "type" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "Account" ALTER COLUMN "type" DROP DEFAULT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Account' AND column_name = 'provider') THEN
    ALTER TABLE "Account" ADD COLUMN "provider" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "Account" ALTER COLUMN "provider" DROP DEFAULT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Account' AND column_name = 'providerAccountId') THEN
    ALTER TABLE "Account" ADD COLUMN "providerAccountId" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "Account" ALTER COLUMN "providerAccountId" DROP DEFAULT;
  END IF;
END $$;
ALTER TABLE "Account" ADD COLUMN IF NOT EXISTS "refresh_token" TEXT;
ALTER TABLE "Account" ADD COLUMN IF NOT EXISTS "access_token" TEXT;
ALTER TABLE "Account" ADD COLUMN IF NOT EXISTS "expires_at" INTEGER;
ALTER TABLE "Account" ADD COLUMN IF NOT EXISTS "token_type" TEXT;
ALTER TABLE "Account" ADD COLUMN IF NOT EXISTS "scope" TEXT;
ALTER TABLE "Account" ADD COLUMN IF NOT EXISTS "id_token" TEXT;
ALTER TABLE "Account" ADD COLUMN IF NOT EXISTS "session_state" TEXT;

-- Session
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Session' AND column_name = 'id') THEN
    ALTER TABLE "Session" ADD COLUMN "id" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "Session" ALTER COLUMN "id" DROP DEFAULT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Session' AND column_name = 'sessionToken') THEN
    ALTER TABLE "Session" ADD COLUMN "sessionToken" TEXT NOT NULL DEFAULT md5(random()::text || clock_timestamp()::text);
    ALTER TABLE "Session" ALTER COLUMN "sessionToken" DROP DEFAULT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Session' AND column_name = 'userId') THEN
    ALTER TABLE "Session" ADD COLUMN "userId" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "Session" ALTER COLUMN "userId" DROP DEFAULT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Session' AND column_name = 'expires') THEN
    ALTER TABLE "Session" ADD COLUMN "expires" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
    ALTER TABLE "Session" ALTER COLUMN "expires" DROP DEFAULT;
  END IF;
END $$;

-- Organization
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Organization' AND column_name = 'id') THEN
    ALTER TABLE "Organization" ADD COLUMN "id" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "Organization" ALTER COLUMN "id" DROP DEFAULT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Organization' AND column_name = 'slug') THEN
    ALTER TABLE "Organization" ADD COLUMN "slug" TEXT NOT NULL DEFAULT md5(random()::text || clock_timestamp()::text);
    ALTER TABLE "Organization" ALTER COLUMN "slug" DROP DEFAULT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Organization' AND column_name = 'name') THEN
    ALTER TABLE "Organization" ADD COLUMN "name" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "Organization" ALTER COLUMN "name" DROP DEFAULT;
  END IF;
END $$;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "logo" TEXT;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "vertical" TEXT NOT NULL DEFAULT 'beauty';
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "palette" TEXT NOT NULL DEFAULT 'rose';
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "plan" TEXT NOT NULL DEFAULT 'free';
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "suspendedAt" TIMESTAMP(3);
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "suspendedReason" TEXT;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Organization' AND column_name = 'updatedAt') THEN
    ALTER TABLE "Organization" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
    ALTER TABLE "Organization" ALTER COLUMN "updatedAt" DROP DEFAULT;
  END IF;
END $$;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "profileVersion" TEXT;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "profileOverrides" JSONB;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "verticalChosenAt" TIMESTAMP(3);
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "setupChecklist" JSONB;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "onboardingAnswers" JSONB;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "secondaryVertical" TEXT;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "skdCodes" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "customTags" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "verticalSkipped" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "publishState" TEXT NOT NULL DEFAULT 'PUBLISHED';
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "publishedAt" TIMESTAMP(3);
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "contentVersion" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "stripeSecretKey" TEXT;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "stripeWebhookSecret" TEXT;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "stripeConfiguredAt" TIMESTAMP(3);

-- PlatformSubscription
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'PlatformSubscription' AND column_name = 'id') THEN
    ALTER TABLE "PlatformSubscription" ADD COLUMN "id" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "PlatformSubscription" ALTER COLUMN "id" DROP DEFAULT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'PlatformSubscription' AND column_name = 'organizationId') THEN
    ALTER TABLE "PlatformSubscription" ADD COLUMN "organizationId" TEXT NOT NULL DEFAULT md5(random()::text || clock_timestamp()::text);
    ALTER TABLE "PlatformSubscription" ALTER COLUMN "organizationId" DROP DEFAULT;
  END IF;
END $$;
ALTER TABLE "PlatformSubscription" ADD COLUMN IF NOT EXISTS "stripeCustomerId" TEXT;
ALTER TABLE "PlatformSubscription" ADD COLUMN IF NOT EXISTS "stripeSubscriptionId" TEXT;
ALTER TABLE "PlatformSubscription" ADD COLUMN IF NOT EXISTS "stripePriceId" TEXT;
ALTER TABLE "PlatformSubscription" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'INCOMPLETE';
ALTER TABLE "PlatformSubscription" ADD COLUMN IF NOT EXISTS "plan" TEXT NOT NULL DEFAULT 'free';
ALTER TABLE "PlatformSubscription" ADD COLUMN IF NOT EXISTS "currentPeriodStart" TIMESTAMP(3);
ALTER TABLE "PlatformSubscription" ADD COLUMN IF NOT EXISTS "currentPeriodEnd" TIMESTAMP(3);
ALTER TABLE "PlatformSubscription" ADD COLUMN IF NOT EXISTS "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "PlatformSubscription" ADD COLUMN IF NOT EXISTS "canceledAt" TIMESTAMP(3);
ALTER TABLE "PlatformSubscription" ADD COLUMN IF NOT EXISTS "pendingCheckoutSessionId" TEXT;
ALTER TABLE "PlatformSubscription" ADD COLUMN IF NOT EXISTS "pendingPlanId" TEXT;
ALTER TABLE "PlatformSubscription" ADD COLUMN IF NOT EXISTS "pendingAt" TIMESTAMP(3);
ALTER TABLE "PlatformSubscription" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'PlatformSubscription' AND column_name = 'updatedAt') THEN
    ALTER TABLE "PlatformSubscription" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
    ALTER TABLE "PlatformSubscription" ALTER COLUMN "updatedAt" DROP DEFAULT;
  END IF;
END $$;

-- PlatformBillingEvent
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'PlatformBillingEvent' AND column_name = 'id') THEN
    ALTER TABLE "PlatformBillingEvent" ADD COLUMN "id" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "PlatformBillingEvent" ALTER COLUMN "id" DROP DEFAULT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'PlatformBillingEvent' AND column_name = 'organizationId') THEN
    ALTER TABLE "PlatformBillingEvent" ADD COLUMN "organizationId" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "PlatformBillingEvent" ALTER COLUMN "organizationId" DROP DEFAULT;
  END IF;
END $$;
ALTER TABLE "PlatformBillingEvent" ADD COLUMN IF NOT EXISTS "subscriptionId" TEXT;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'PlatformBillingEvent' AND column_name = 'stripeEventId') THEN
    ALTER TABLE "PlatformBillingEvent" ADD COLUMN "stripeEventId" TEXT NOT NULL DEFAULT md5(random()::text || clock_timestamp()::text);
    ALTER TABLE "PlatformBillingEvent" ALTER COLUMN "stripeEventId" DROP DEFAULT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'PlatformBillingEvent' AND column_name = 'type') THEN
    ALTER TABLE "PlatformBillingEvent" ADD COLUMN "type" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "PlatformBillingEvent" ALTER COLUMN "type" DROP DEFAULT;
  END IF;
END $$;
ALTER TABLE "PlatformBillingEvent" ADD COLUMN IF NOT EXISTS "amountCents" INTEGER;
ALTER TABLE "PlatformBillingEvent" ADD COLUMN IF NOT EXISTS "currency" TEXT;
ALTER TABLE "PlatformBillingEvent" ADD COLUMN IF NOT EXISTS "plan" TEXT;
ALTER TABLE "PlatformBillingEvent" ADD COLUMN IF NOT EXISTS "periodStart" TIMESTAMP(3);
ALTER TABLE "PlatformBillingEvent" ADD COLUMN IF NOT EXISTS "periodEnd" TIMESTAMP(3);
ALTER TABLE "PlatformBillingEvent" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- PlatformAuditLog
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'PlatformAuditLog' AND column_name = 'id') THEN
    ALTER TABLE "PlatformAuditLog" ADD COLUMN "id" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "PlatformAuditLog" ALTER COLUMN "id" DROP DEFAULT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'PlatformAuditLog' AND column_name = 'organizationId') THEN
    ALTER TABLE "PlatformAuditLog" ADD COLUMN "organizationId" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "PlatformAuditLog" ALTER COLUMN "organizationId" DROP DEFAULT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'PlatformAuditLog' AND column_name = 'actorEmail') THEN
    ALTER TABLE "PlatformAuditLog" ADD COLUMN "actorEmail" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "PlatformAuditLog" ALTER COLUMN "actorEmail" DROP DEFAULT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'PlatformAuditLog' AND column_name = 'action') THEN
    ALTER TABLE "PlatformAuditLog" ADD COLUMN "action" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "PlatformAuditLog" ALTER COLUMN "action" DROP DEFAULT;
  END IF;
END $$;
ALTER TABLE "PlatformAuditLog" ADD COLUMN IF NOT EXISTS "reason" TEXT;
ALTER TABLE "PlatformAuditLog" ADD COLUMN IF NOT EXISTS "metadata" JSONB;
ALTER TABLE "PlatformAuditLog" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- PlatformWebhookFailure
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'PlatformWebhookFailure' AND column_name = 'id') THEN
    ALTER TABLE "PlatformWebhookFailure" ADD COLUMN "id" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "PlatformWebhookFailure" ALTER COLUMN "id" DROP DEFAULT;
  END IF;
END $$;
ALTER TABLE "PlatformWebhookFailure" ADD COLUMN IF NOT EXISTS "stripeEventId" TEXT;
ALTER TABLE "PlatformWebhookFailure" ADD COLUMN IF NOT EXISTS "type" TEXT;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'PlatformWebhookFailure' AND column_name = 'reason') THEN
    ALTER TABLE "PlatformWebhookFailure" ADD COLUMN "reason" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "PlatformWebhookFailure" ALTER COLUMN "reason" DROP DEFAULT;
  END IF;
END $$;
ALTER TABLE "PlatformWebhookFailure" ADD COLUMN IF NOT EXISTS "detail" TEXT;
ALTER TABLE "PlatformWebhookFailure" ADD COLUMN IF NOT EXISTS "payloadSnippet" TEXT;
ALTER TABLE "PlatformWebhookFailure" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Media
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Media' AND column_name = 'id') THEN
    ALTER TABLE "Media" ADD COLUMN "id" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "Media" ALTER COLUMN "id" DROP DEFAULT;
  END IF;
END $$;
ALTER TABLE "Media" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Media' AND column_name = 'filename') THEN
    ALTER TABLE "Media" ADD COLUMN "filename" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "Media" ALTER COLUMN "filename" DROP DEFAULT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Media' AND column_name = 'mimeType') THEN
    ALTER TABLE "Media" ADD COLUMN "mimeType" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "Media" ALTER COLUMN "mimeType" DROP DEFAULT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Media' AND column_name = 'size') THEN
    ALTER TABLE "Media" ADD COLUMN "size" INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE "Media" ALTER COLUMN "size" DROP DEFAULT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Media' AND column_name = 'data') THEN
    ALTER TABLE "Media" ADD COLUMN "data" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "Media" ALTER COLUMN "data" DROP DEFAULT;
  END IF;
END $$;
ALTER TABLE "Media" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- User
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'User' AND column_name = 'id') THEN
    ALTER TABLE "User" ADD COLUMN "id" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "User" ALTER COLUMN "id" DROP DEFAULT;
  END IF;
END $$;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "name" TEXT;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'User' AND column_name = 'email') THEN
    ALTER TABLE "User" ADD COLUMN "email" TEXT NOT NULL DEFAULT md5(random()::text || clock_timestamp()::text);
    ALTER TABLE "User" ALTER COLUMN "email" DROP DEFAULT;
  END IF;
END $$;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailVerified" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "image" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "password" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "role" "UserRole" NOT NULL DEFAULT 'CLIENTE';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'User' AND column_name = 'updatedAt') THEN
    ALTER TABLE "User" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
    ALTER TABLE "User" ALTER COLUMN "updatedAt" DROP DEFAULT;
  END IF;
END $$;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "resetToken" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "resetTokenExpiry" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "customRoleId" TEXT;

-- NotificationPreferences
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'NotificationPreferences' AND column_name = 'id') THEN
    ALTER TABLE "NotificationPreferences" ADD COLUMN "id" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "NotificationPreferences" ALTER COLUMN "id" DROP DEFAULT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'NotificationPreferences' AND column_name = 'userId') THEN
    ALTER TABLE "NotificationPreferences" ADD COLUMN "userId" TEXT NOT NULL DEFAULT md5(random()::text || clock_timestamp()::text);
    ALTER TABLE "NotificationPreferences" ALTER COLUMN "userId" DROP DEFAULT;
  END IF;
END $$;
ALTER TABLE "NotificationPreferences" ADD COLUMN IF NOT EXISTS "emailReminders" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "NotificationPreferences" ADD COLUMN IF NOT EXISTS "reminderTime" TEXT NOT NULL DEFAULT '24h';
ALTER TABLE "NotificationPreferences" ADD COLUMN IF NOT EXISTS "promotionalEmails" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "NotificationPreferences" ADD COLUMN IF NOT EXISTS "appointmentUpdates" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "NotificationPreferences" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'NotificationPreferences' AND column_name = 'updatedAt') THEN
    ALTER TABLE "NotificationPreferences" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
    ALTER TABLE "NotificationPreferences" ALTER COLUMN "updatedAt" DROP DEFAULT;
  END IF;
END $$;

-- CustomRole
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'CustomRole' AND column_name = 'id') THEN
    ALTER TABLE "CustomRole" ADD COLUMN "id" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "CustomRole" ALTER COLUMN "id" DROP DEFAULT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'CustomRole' AND column_name = 'organizationId') THEN
    ALTER TABLE "CustomRole" ADD COLUMN "organizationId" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "CustomRole" ALTER COLUMN "organizationId" DROP DEFAULT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'CustomRole' AND column_name = 'name') THEN
    ALTER TABLE "CustomRole" ADD COLUMN "name" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "CustomRole" ALTER COLUMN "name" DROP DEFAULT;
  END IF;
END $$;
ALTER TABLE "CustomRole" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "CustomRole" ADD COLUMN IF NOT EXISTS "permissions" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "CustomRole" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'CustomRole' AND column_name = 'updatedAt') THEN
    ALTER TABLE "CustomRole" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
    ALTER TABLE "CustomRole" ALTER COLUMN "updatedAt" DROP DEFAULT;
  END IF;
END $$;

-- VerificationToken
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'VerificationToken' AND column_name = 'identifier') THEN
    ALTER TABLE "VerificationToken" ADD COLUMN "identifier" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "VerificationToken" ALTER COLUMN "identifier" DROP DEFAULT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'VerificationToken' AND column_name = 'token') THEN
    ALTER TABLE "VerificationToken" ADD COLUMN "token" TEXT NOT NULL DEFAULT md5(random()::text || clock_timestamp()::text);
    ALTER TABLE "VerificationToken" ALTER COLUMN "token" DROP DEFAULT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'VerificationToken' AND column_name = 'expires') THEN
    ALTER TABLE "VerificationToken" ADD COLUMN "expires" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
    ALTER TABLE "VerificationToken" ALTER COLUMN "expires" DROP DEFAULT;
  END IF;
END $$;

-- SalonConfig
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'SalonConfig' AND column_name = 'id') THEN
    ALTER TABLE "SalonConfig" ADD COLUMN "id" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "SalonConfig" ALTER COLUMN "id" DROP DEFAULT;
  END IF;
END $$;
ALTER TABLE "SalonConfig" ADD COLUMN IF NOT EXISTS "name" TEXT NOT NULL DEFAULT 'Beauty Salon';
ALTER TABLE "SalonConfig" ADD COLUMN IF NOT EXISTS "logo" TEXT;
ALTER TABLE "SalonConfig" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
ALTER TABLE "SalonConfig" ADD COLUMN IF NOT EXISTS "siteContent" JSONB;
ALTER TABLE "SalonConfig" ADD COLUMN IF NOT EXISTS "theme" JSONB;
ALTER TABLE "SalonConfig" ADD COLUMN IF NOT EXISTS "publishedSiteContent" JSONB;
ALTER TABLE "SalonConfig" ADD COLUMN IF NOT EXISTS "publishedContentVersion" INTEGER;
ALTER TABLE "SalonConfig" ADD COLUMN IF NOT EXISTS "primaryColor" TEXT NOT NULL DEFAULT '#000000';
ALTER TABLE "SalonConfig" ADD COLUMN IF NOT EXISTS "secondaryColor" TEXT NOT NULL DEFAULT '#ffffff';
ALTER TABLE "SalonConfig" ADD COLUMN IF NOT EXISTS "accentColor" TEXT NOT NULL DEFAULT '#d4af37';
ALTER TABLE "SalonConfig" ADD COLUMN IF NOT EXISTS "email" TEXT;
ALTER TABLE "SalonConfig" ADD COLUMN IF NOT EXISTS "phone" TEXT;
ALTER TABLE "SalonConfig" ADD COLUMN IF NOT EXISTS "address" TEXT;
ALTER TABLE "SalonConfig" ADD COLUMN IF NOT EXISTS "city" TEXT;
ALTER TABLE "SalonConfig" ADD COLUMN IF NOT EXISTS "state" TEXT;
ALTER TABLE "SalonConfig" ADD COLUMN IF NOT EXISTS "zipCode" TEXT;
ALTER TABLE "SalonConfig" ADD COLUMN IF NOT EXISTS "country" TEXT NOT NULL DEFAULT 'US';
ALTER TABLE "SalonConfig" ADD COLUMN IF NOT EXISTS "timezone" TEXT NOT NULL DEFAULT 'Europe/Ljubljana';
ALTER TABLE "SalonConfig" ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'EUR';
ALTER TABLE "SalonConfig" ADD COLUMN IF NOT EXISTS "locale" TEXT NOT NULL DEFAULT 'sl';
ALTER TABLE "SalonConfig" ADD COLUMN IF NOT EXISTS "bookingDeposit" DECIMAL(10,2) NOT NULL DEFAULT 50.00;
ALTER TABLE "SalonConfig" ADD COLUMN IF NOT EXISTS "depositRefundable" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "SalonConfig" ADD COLUMN IF NOT EXISTS "bookingDepositType" "DepositType" NOT NULL DEFAULT 'FIXED';
ALTER TABLE "SalonConfig" ADD COLUMN IF NOT EXISTS "defaultReorderPoint" INTEGER NOT NULL DEFAULT 10;
ALTER TABLE "SalonConfig" ADD COLUMN IF NOT EXISTS "minBookingAdvance" INTEGER NOT NULL DEFAULT 24;
ALTER TABLE "SalonConfig" ADD COLUMN IF NOT EXISTS "maxBookingAdvance" INTEGER NOT NULL DEFAULT 30;
ALTER TABLE "SalonConfig" ADD COLUMN IF NOT EXISTS "cancellationPolicy" TEXT;
ALTER TABLE "SalonConfig" ADD COLUMN IF NOT EXISTS "analyticsMeasurementId" TEXT;
ALTER TABLE "SalonConfig" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'SalonConfig' AND column_name = 'updatedAt') THEN
    ALTER TABLE "SalonConfig" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
    ALTER TABLE "SalonConfig" ALTER COLUMN "updatedAt" DROP DEFAULT;
  END IF;
END $$;

-- Category
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Category' AND column_name = 'id') THEN
    ALTER TABLE "Category" ADD COLUMN "id" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "Category" ALTER COLUMN "id" DROP DEFAULT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Category' AND column_name = 'name') THEN
    ALTER TABLE "Category" ADD COLUMN "name" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "Category" ALTER COLUMN "name" DROP DEFAULT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Category' AND column_name = 'slug') THEN
    ALTER TABLE "Category" ADD COLUMN "slug" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "Category" ALTER COLUMN "slug" DROP DEFAULT;
  END IF;
END $$;
ALTER TABLE "Category" ADD COLUMN IF NOT EXISTS "presetSeed" TEXT;
ALTER TABLE "Category" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
ALTER TABLE "Category" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Category' AND column_name = 'updatedAt') THEN
    ALTER TABLE "Category" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
    ALTER TABLE "Category" ALTER COLUMN "updatedAt" DROP DEFAULT;
  END IF;
END $$;

-- Service
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Service' AND column_name = 'id') THEN
    ALTER TABLE "Service" ADD COLUMN "id" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "Service" ALTER COLUMN "id" DROP DEFAULT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Service' AND column_name = 'name') THEN
    ALTER TABLE "Service" ADD COLUMN "name" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "Service" ALTER COLUMN "name" DROP DEFAULT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Service' AND column_name = 'slug') THEN
    ALTER TABLE "Service" ADD COLUMN "slug" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "Service" ALTER COLUMN "slug" DROP DEFAULT;
  END IF;
END $$;
ALTER TABLE "Service" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "Service" ADD COLUMN IF NOT EXISTS "presetSeed" TEXT;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Service' AND column_name = 'duration') THEN
    ALTER TABLE "Service" ADD COLUMN "duration" INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE "Service" ALTER COLUMN "duration" DROP DEFAULT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Service' AND column_name = 'price') THEN
    ALTER TABLE "Service" ADD COLUMN "price" DECIMAL(10,2) NOT NULL DEFAULT 0;
    ALTER TABLE "Service" ALTER COLUMN "price" DROP DEFAULT;
  END IF;
END $$;
ALTER TABLE "Service" ADD COLUMN IF NOT EXISTS "imageUrl" TEXT;
ALTER TABLE "Service" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Service" ADD COLUMN IF NOT EXISTS "isFeatured" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Service" ADD COLUMN IF NOT EXISTS "order" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Service" ADD COLUMN IF NOT EXISTS "depositType" "DepositType" NOT NULL DEFAULT 'INHERIT';
ALTER TABLE "Service" ADD COLUMN IF NOT EXISTS "depositValue" DECIMAL(10,2);
ALTER TABLE "Service" ADD COLUMN IF NOT EXISTS "categoryId" TEXT;
ALTER TABLE "Service" ADD COLUMN IF NOT EXISTS "intakeFormDefinitionId" TEXT;
ALTER TABLE "Service" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
ALTER TABLE "Service" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Service' AND column_name = 'updatedAt') THEN
    ALTER TABLE "Service" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
    ALTER TABLE "Service" ALTER COLUMN "updatedAt" DROP DEFAULT;
  END IF;
END $$;

-- Review
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Review' AND column_name = 'id') THEN
    ALTER TABLE "Review" ADD COLUMN "id" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "Review" ALTER COLUMN "id" DROP DEFAULT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Review' AND column_name = 'rating') THEN
    ALTER TABLE "Review" ADD COLUMN "rating" INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE "Review" ALTER COLUMN "rating" DROP DEFAULT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Review' AND column_name = 'comment') THEN
    ALTER TABLE "Review" ADD COLUMN "comment" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "Review" ALTER COLUMN "comment" DROP DEFAULT;
  END IF;
END $$;
ALTER TABLE "Review" ADD COLUMN IF NOT EXISTS "serviceId" TEXT;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Review' AND column_name = 'organizationId') THEN
    ALTER TABLE "Review" ADD COLUMN "organizationId" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "Review" ALTER COLUMN "organizationId" DROP DEFAULT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Review' AND column_name = 'userId') THEN
    ALTER TABLE "Review" ADD COLUMN "userId" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "Review" ALTER COLUMN "userId" DROP DEFAULT;
  END IF;
END $$;
ALTER TABLE "Review" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Review" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Review' AND column_name = 'updatedAt') THEN
    ALTER TABLE "Review" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
    ALTER TABLE "Review" ALTER COLUMN "updatedAt" DROP DEFAULT;
  END IF;
END $$;

-- ServiceGallery
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'ServiceGallery' AND column_name = 'id') THEN
    ALTER TABLE "ServiceGallery" ADD COLUMN "id" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "ServiceGallery" ALTER COLUMN "id" DROP DEFAULT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'ServiceGallery' AND column_name = 'imageUrl') THEN
    ALTER TABLE "ServiceGallery" ADD COLUMN "imageUrl" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "ServiceGallery" ALTER COLUMN "imageUrl" DROP DEFAULT;
  END IF;
END $$;
ALTER TABLE "ServiceGallery" ADD COLUMN IF NOT EXISTS "caption" TEXT;
ALTER TABLE "ServiceGallery" ADD COLUMN IF NOT EXISTS "order" INTEGER NOT NULL DEFAULT 0;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'ServiceGallery' AND column_name = 'serviceId') THEN
    ALTER TABLE "ServiceGallery" ADD COLUMN "serviceId" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "ServiceGallery" ALTER COLUMN "serviceId" DROP DEFAULT;
  END IF;
END $$;
ALTER TABLE "ServiceGallery" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- ServiceFAQ
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'ServiceFAQ' AND column_name = 'id') THEN
    ALTER TABLE "ServiceFAQ" ADD COLUMN "id" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "ServiceFAQ" ALTER COLUMN "id" DROP DEFAULT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'ServiceFAQ' AND column_name = 'question') THEN
    ALTER TABLE "ServiceFAQ" ADD COLUMN "question" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "ServiceFAQ" ALTER COLUMN "question" DROP DEFAULT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'ServiceFAQ' AND column_name = 'answer') THEN
    ALTER TABLE "ServiceFAQ" ADD COLUMN "answer" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "ServiceFAQ" ALTER COLUMN "answer" DROP DEFAULT;
  END IF;
END $$;
ALTER TABLE "ServiceFAQ" ADD COLUMN IF NOT EXISTS "order" INTEGER NOT NULL DEFAULT 0;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'ServiceFAQ' AND column_name = 'serviceId') THEN
    ALTER TABLE "ServiceFAQ" ADD COLUMN "serviceId" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "ServiceFAQ" ALTER COLUMN "serviceId" DROP DEFAULT;
  END IF;
END $$;
ALTER TABLE "ServiceFAQ" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'ServiceFAQ' AND column_name = 'updatedAt') THEN
    ALTER TABLE "ServiceFAQ" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
    ALTER TABLE "ServiceFAQ" ALTER COLUMN "updatedAt" DROP DEFAULT;
  END IF;
END $$;

-- Staff
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Staff' AND column_name = 'id') THEN
    ALTER TABLE "Staff" ADD COLUMN "id" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "Staff" ALTER COLUMN "id" DROP DEFAULT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Staff' AND column_name = 'name') THEN
    ALTER TABLE "Staff" ADD COLUMN "name" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "Staff" ALTER COLUMN "name" DROP DEFAULT;
  END IF;
END $$;
ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS "email" TEXT;
ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS "phone" TEXT;
ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS "bio" TEXT;
ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS "image" TEXT;
ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS "defaultTipPercent" DECIMAL(5,2);
ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS "commissionType" "CommissionType" NOT NULL DEFAULT 'NONE';
ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS "commissionValue" DECIMAL(10,2);
ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS "commissionBasis" TEXT NOT NULL DEFAULT 'service';
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Staff' AND column_name = 'userId') THEN
    ALTER TABLE "Staff" ADD COLUMN "userId" TEXT NOT NULL DEFAULT md5(random()::text || clock_timestamp()::text);
    ALTER TABLE "Staff" ALTER COLUMN "userId" DROP DEFAULT;
  END IF;
END $$;
ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Staff' AND column_name = 'updatedAt') THEN
    ALTER TABLE "Staff" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
    ALTER TABLE "Staff" ALTER COLUMN "updatedAt" DROP DEFAULT;
  END IF;
END $$;

-- StaffService
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'StaffService' AND column_name = 'id') THEN
    ALTER TABLE "StaffService" ADD COLUMN "id" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "StaffService" ALTER COLUMN "id" DROP DEFAULT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'StaffService' AND column_name = 'staffId') THEN
    ALTER TABLE "StaffService" ADD COLUMN "staffId" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "StaffService" ALTER COLUMN "staffId" DROP DEFAULT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'StaffService' AND column_name = 'serviceId') THEN
    ALTER TABLE "StaffService" ADD COLUMN "serviceId" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "StaffService" ALTER COLUMN "serviceId" DROP DEFAULT;
  END IF;
END $$;

-- WorkingHours
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'WorkingHours' AND column_name = 'id') THEN
    ALTER TABLE "WorkingHours" ADD COLUMN "id" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "WorkingHours" ALTER COLUMN "id" DROP DEFAULT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'WorkingHours' AND column_name = 'staffId') THEN
    ALTER TABLE "WorkingHours" ADD COLUMN "staffId" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "WorkingHours" ALTER COLUMN "staffId" DROP DEFAULT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'WorkingHours' AND column_name = 'dayOfWeek') THEN
    ALTER TABLE "WorkingHours" ADD COLUMN "dayOfWeek" INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE "WorkingHours" ALTER COLUMN "dayOfWeek" DROP DEFAULT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'WorkingHours' AND column_name = 'startTime') THEN
    ALTER TABLE "WorkingHours" ADD COLUMN "startTime" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "WorkingHours" ALTER COLUMN "startTime" DROP DEFAULT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'WorkingHours' AND column_name = 'endTime') THEN
    ALTER TABLE "WorkingHours" ADD COLUMN "endTime" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "WorkingHours" ALTER COLUMN "endTime" DROP DEFAULT;
  END IF;
END $$;
ALTER TABLE "WorkingHours" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;

-- Customer
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Customer' AND column_name = 'id') THEN
    ALTER TABLE "Customer" ADD COLUMN "id" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "Customer" ALTER COLUMN "id" DROP DEFAULT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Customer' AND column_name = 'name') THEN
    ALTER TABLE "Customer" ADD COLUMN "name" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "Customer" ALTER COLUMN "name" DROP DEFAULT;
  END IF;
END $$;
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "email" TEXT;
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "phone" TEXT;
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "notes" TEXT;
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "dateOfBirth" TIMESTAMP(3);
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "userId" TEXT;
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Customer' AND column_name = 'updatedAt') THEN
    ALTER TABLE "Customer" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
    ALTER TABLE "Customer" ALTER COLUMN "updatedAt" DROP DEFAULT;
  END IF;
END $$;

-- WaitlistEntry
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'WaitlistEntry' AND column_name = 'id') THEN
    ALTER TABLE "WaitlistEntry" ADD COLUMN "id" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "WaitlistEntry" ALTER COLUMN "id" DROP DEFAULT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'WaitlistEntry' AND column_name = 'organizationId') THEN
    ALTER TABLE "WaitlistEntry" ADD COLUMN "organizationId" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "WaitlistEntry" ALTER COLUMN "organizationId" DROP DEFAULT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'WaitlistEntry' AND column_name = 'name') THEN
    ALTER TABLE "WaitlistEntry" ADD COLUMN "name" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "WaitlistEntry" ALTER COLUMN "name" DROP DEFAULT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'WaitlistEntry' AND column_name = 'email') THEN
    ALTER TABLE "WaitlistEntry" ADD COLUMN "email" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "WaitlistEntry" ALTER COLUMN "email" DROP DEFAULT;
  END IF;
END $$;
ALTER TABLE "WaitlistEntry" ADD COLUMN IF NOT EXISTS "phone" TEXT;
ALTER TABLE "WaitlistEntry" ADD COLUMN IF NOT EXISTS "serviceId" TEXT;
ALTER TABLE "WaitlistEntry" ADD COLUMN IF NOT EXISTS "preferredDate" TIMESTAMP(3);
ALTER TABLE "WaitlistEntry" ADD COLUMN IF NOT EXISTS "notes" TEXT;
ALTER TABLE "WaitlistEntry" ADD COLUMN IF NOT EXISTS "status" "WaitlistStatus" NOT NULL DEFAULT 'WAITING';
ALTER TABLE "WaitlistEntry" ADD COLUMN IF NOT EXISTS "notifiedAt" TIMESTAMP(3);
ALTER TABLE "WaitlistEntry" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'WaitlistEntry' AND column_name = 'updatedAt') THEN
    ALTER TABLE "WaitlistEntry" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
    ALTER TABLE "WaitlistEntry" ALTER COLUMN "updatedAt" DROP DEFAULT;
  END IF;
END $$;

-- ServiceAddon
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'ServiceAddon' AND column_name = 'id') THEN
    ALTER TABLE "ServiceAddon" ADD COLUMN "id" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "ServiceAddon" ALTER COLUMN "id" DROP DEFAULT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'ServiceAddon' AND column_name = 'serviceId') THEN
    ALTER TABLE "ServiceAddon" ADD COLUMN "serviceId" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "ServiceAddon" ALTER COLUMN "serviceId" DROP DEFAULT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'ServiceAddon' AND column_name = 'name') THEN
    ALTER TABLE "ServiceAddon" ADD COLUMN "name" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "ServiceAddon" ALTER COLUMN "name" DROP DEFAULT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'ServiceAddon' AND column_name = 'price') THEN
    ALTER TABLE "ServiceAddon" ADD COLUMN "price" DECIMAL(10,2) NOT NULL DEFAULT 0;
    ALTER TABLE "ServiceAddon" ALTER COLUMN "price" DROP DEFAULT;
  END IF;
END $$;
ALTER TABLE "ServiceAddon" ADD COLUMN IF NOT EXISTS "durationMin" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ServiceAddon" ADD COLUMN IF NOT EXISTS "position" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ServiceAddon" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;

-- MarketingCampaign
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'MarketingCampaign' AND column_name = 'id') THEN
    ALTER TABLE "MarketingCampaign" ADD COLUMN "id" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "MarketingCampaign" ALTER COLUMN "id" DROP DEFAULT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'MarketingCampaign' AND column_name = 'organizationId') THEN
    ALTER TABLE "MarketingCampaign" ADD COLUMN "organizationId" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "MarketingCampaign" ALTER COLUMN "organizationId" DROP DEFAULT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'MarketingCampaign' AND column_name = 'kind') THEN
    ALTER TABLE "MarketingCampaign" ADD COLUMN "kind" "CampaignKind" NOT NULL DEFAULT 'REACTIVATION';
    ALTER TABLE "MarketingCampaign" ALTER COLUMN "kind" DROP DEFAULT;
  END IF;
END $$;
ALTER TABLE "MarketingCampaign" ADD COLUMN IF NOT EXISTS "enabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "MarketingCampaign" ADD COLUMN IF NOT EXISTS "thresholdDays" INTEGER NOT NULL DEFAULT 60;
ALTER TABLE "MarketingCampaign" ADD COLUMN IF NOT EXISTS "tagFilter" TEXT;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'MarketingCampaign' AND column_name = 'subject') THEN
    ALTER TABLE "MarketingCampaign" ADD COLUMN "subject" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "MarketingCampaign" ALTER COLUMN "subject" DROP DEFAULT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'MarketingCampaign' AND column_name = 'body') THEN
    ALTER TABLE "MarketingCampaign" ADD COLUMN "body" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "MarketingCampaign" ALTER COLUMN "body" DROP DEFAULT;
  END IF;
END $$;
ALTER TABLE "MarketingCampaign" ADD COLUMN IF NOT EXISTS "lastRunAt" TIMESTAMP(3);
ALTER TABLE "MarketingCampaign" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'MarketingCampaign' AND column_name = 'updatedAt') THEN
    ALTER TABLE "MarketingCampaign" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
    ALTER TABLE "MarketingCampaign" ALTER COLUMN "updatedAt" DROP DEFAULT;
  END IF;
END $$;

-- CampaignSend
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'CampaignSend' AND column_name = 'id') THEN
    ALTER TABLE "CampaignSend" ADD COLUMN "id" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "CampaignSend" ALTER COLUMN "id" DROP DEFAULT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'CampaignSend' AND column_name = 'campaignId') THEN
    ALTER TABLE "CampaignSend" ADD COLUMN "campaignId" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "CampaignSend" ALTER COLUMN "campaignId" DROP DEFAULT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'CampaignSend' AND column_name = 'email') THEN
    ALTER TABLE "CampaignSend" ADD COLUMN "email" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "CampaignSend" ALTER COLUMN "email" DROP DEFAULT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'CampaignSend' AND column_name = 'triggerKey') THEN
    ALTER TABLE "CampaignSend" ADD COLUMN "triggerKey" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "CampaignSend" ALTER COLUMN "triggerKey" DROP DEFAULT;
  END IF;
END $$;
ALTER TABLE "CampaignSend" ADD COLUMN IF NOT EXISTS "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- WalkInEntry
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'WalkInEntry' AND column_name = 'id') THEN
    ALTER TABLE "WalkInEntry" ADD COLUMN "id" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "WalkInEntry" ALTER COLUMN "id" DROP DEFAULT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'WalkInEntry' AND column_name = 'organizationId') THEN
    ALTER TABLE "WalkInEntry" ADD COLUMN "organizationId" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "WalkInEntry" ALTER COLUMN "organizationId" DROP DEFAULT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'WalkInEntry' AND column_name = 'name') THEN
    ALTER TABLE "WalkInEntry" ADD COLUMN "name" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "WalkInEntry" ALTER COLUMN "name" DROP DEFAULT;
  END IF;
END $$;
ALTER TABLE "WalkInEntry" ADD COLUMN IF NOT EXISTS "phone" TEXT;
ALTER TABLE "WalkInEntry" ADD COLUMN IF NOT EXISTS "serviceId" TEXT;
ALTER TABLE "WalkInEntry" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'WAITING';
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'WalkInEntry' AND column_name = 'ticketCode') THEN
    ALTER TABLE "WalkInEntry" ADD COLUMN "ticketCode" TEXT NOT NULL DEFAULT md5(random()::text || clock_timestamp()::text);
    ALTER TABLE "WalkInEntry" ALTER COLUMN "ticketCode" DROP DEFAULT;
  END IF;
END $$;
ALTER TABLE "WalkInEntry" ADD COLUMN IF NOT EXISTS "servedAt" TIMESTAMP(3);
ALTER TABLE "WalkInEntry" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'WalkInEntry' AND column_name = 'updatedAt') THEN
    ALTER TABLE "WalkInEntry" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
    ALTER TABLE "WalkInEntry" ALTER COLUMN "updatedAt" DROP DEFAULT;
  END IF;
END $$;

-- MarketingUnsubscribe
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'MarketingUnsubscribe' AND column_name = 'id') THEN
    ALTER TABLE "MarketingUnsubscribe" ADD COLUMN "id" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "MarketingUnsubscribe" ALTER COLUMN "id" DROP DEFAULT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'MarketingUnsubscribe' AND column_name = 'organizationId') THEN
    ALTER TABLE "MarketingUnsubscribe" ADD COLUMN "organizationId" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "MarketingUnsubscribe" ALTER COLUMN "organizationId" DROP DEFAULT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'MarketingUnsubscribe' AND column_name = 'email') THEN
    ALTER TABLE "MarketingUnsubscribe" ADD COLUMN "email" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "MarketingUnsubscribe" ALTER COLUMN "email" DROP DEFAULT;
  END IF;
END $$;
ALTER TABLE "MarketingUnsubscribe" ADD COLUMN IF NOT EXISTS "unsubscribedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- PushSubscription
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'PushSubscription' AND column_name = 'id') THEN
    ALTER TABLE "PushSubscription" ADD COLUMN "id" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "PushSubscription" ALTER COLUMN "id" DROP DEFAULT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'PushSubscription' AND column_name = 'userId') THEN
    ALTER TABLE "PushSubscription" ADD COLUMN "userId" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "PushSubscription" ALTER COLUMN "userId" DROP DEFAULT;
  END IF;
END $$;
ALTER TABLE "PushSubscription" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'PushSubscription' AND column_name = 'endpoint') THEN
    ALTER TABLE "PushSubscription" ADD COLUMN "endpoint" TEXT NOT NULL DEFAULT md5(random()::text || clock_timestamp()::text);
    ALTER TABLE "PushSubscription" ALTER COLUMN "endpoint" DROP DEFAULT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'PushSubscription' AND column_name = 'p256dh') THEN
    ALTER TABLE "PushSubscription" ADD COLUMN "p256dh" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "PushSubscription" ALTER COLUMN "p256dh" DROP DEFAULT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'PushSubscription' AND column_name = 'auth') THEN
    ALTER TABLE "PushSubscription" ADD COLUMN "auth" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "PushSubscription" ALTER COLUMN "auth" DROP DEFAULT;
  END IF;
END $$;
ALTER TABLE "PushSubscription" ADD COLUMN IF NOT EXISTS "userAgent" TEXT;
ALTER TABLE "PushSubscription" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- OrganizationMember
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'OrganizationMember' AND column_name = 'id') THEN
    ALTER TABLE "OrganizationMember" ADD COLUMN "id" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "OrganizationMember" ALTER COLUMN "id" DROP DEFAULT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'OrganizationMember' AND column_name = 'organizationId') THEN
    ALTER TABLE "OrganizationMember" ADD COLUMN "organizationId" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "OrganizationMember" ALTER COLUMN "organizationId" DROP DEFAULT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'OrganizationMember' AND column_name = 'userId') THEN
    ALTER TABLE "OrganizationMember" ADD COLUMN "userId" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "OrganizationMember" ALTER COLUMN "userId" DROP DEFAULT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'OrganizationMember' AND column_name = 'role') THEN
    ALTER TABLE "OrganizationMember" ADD COLUMN "role" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "OrganizationMember" ALTER COLUMN "role" DROP DEFAULT;
  END IF;
END $$;
ALTER TABLE "OrganizationMember" ADD COLUMN IF NOT EXISTS "customRoleId" TEXT;
ALTER TABLE "OrganizationMember" ADD COLUMN IF NOT EXISTS "isDefault" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "OrganizationMember" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- OrganizationModuleState
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'OrganizationModuleState' AND column_name = 'id') THEN
    ALTER TABLE "OrganizationModuleState" ADD COLUMN "id" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "OrganizationModuleState" ALTER COLUMN "id" DROP DEFAULT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'OrganizationModuleState' AND column_name = 'organizationId') THEN
    ALTER TABLE "OrganizationModuleState" ADD COLUMN "organizationId" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "OrganizationModuleState" ALTER COLUMN "organizationId" DROP DEFAULT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'OrganizationModuleState' AND column_name = 'moduleId') THEN
    ALTER TABLE "OrganizationModuleState" ADD COLUMN "moduleId" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "OrganizationModuleState" ALTER COLUMN "moduleId" DROP DEFAULT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'OrganizationModuleState' AND column_name = 'state') THEN
    ALTER TABLE "OrganizationModuleState" ADD COLUMN "state" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "OrganizationModuleState" ALTER COLUMN "state" DROP DEFAULT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'OrganizationModuleState' AND column_name = 'updatedAt') THEN
    ALTER TABLE "OrganizationModuleState" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
    ALTER TABLE "OrganizationModuleState" ALTER COLUMN "updatedAt" DROP DEFAULT;
  END IF;
END $$;

-- Appointment
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Appointment' AND column_name = 'id') THEN
    ALTER TABLE "Appointment" ADD COLUMN "id" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "Appointment" ALTER COLUMN "id" DROP DEFAULT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Appointment' AND column_name = 'staffId') THEN
    ALTER TABLE "Appointment" ADD COLUMN "staffId" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "Appointment" ALTER COLUMN "staffId" DROP DEFAULT;
  END IF;
END $$;
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "customerId" TEXT;
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "guestName" TEXT;
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "guestEmail" TEXT;
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "guestPhone" TEXT;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Appointment' AND column_name = 'startTime') THEN
    ALTER TABLE "Appointment" ADD COLUMN "startTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
    ALTER TABLE "Appointment" ALTER COLUMN "startTime" DROP DEFAULT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Appointment' AND column_name = 'endTime') THEN
    ALTER TABLE "Appointment" ADD COLUMN "endTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
    ALTER TABLE "Appointment" ALTER COLUMN "endTime" DROP DEFAULT;
  END IF;
END $$;
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "status" "AppointmentStatus" NOT NULL DEFAULT 'PENDING';
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "notes" TEXT;
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "resourceRecordId" TEXT;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Appointment' AND column_name = 'totalPrice') THEN
    ALTER TABLE "Appointment" ADD COLUMN "totalPrice" DECIMAL(10,2) NOT NULL DEFAULT 0;
    ALTER TABLE "Appointment" ALTER COLUMN "totalPrice" DROP DEFAULT;
  END IF;
END $$;
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "depositAmount" DECIMAL(10,2) NOT NULL DEFAULT 50.00;
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "depositPaid" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "stripePaymentId" TEXT;
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "tipAmount" DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "tipMethod" TEXT;
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "commissionAmount" DECIMAL(10,2);
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "addons" JSONB;
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "reminderSentAt" TIMESTAMP(3);
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "confirmationSentAt" TIMESTAMP(3);
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "intakeToken" TEXT;
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "noShowConsent" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "stripeSetupIntentId" TEXT;
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "stripeCustomerId" TEXT;
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "noShowSetupStatus" TEXT NOT NULL DEFAULT 'NONE';
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "noShowChargeStatus" TEXT NOT NULL DEFAULT 'NONE';
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "noShowChargeId" TEXT;
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Appointment' AND column_name = 'updatedAt') THEN
    ALTER TABLE "Appointment" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
    ALTER TABLE "Appointment" ALTER COLUMN "updatedAt" DROP DEFAULT;
  END IF;
END $$;

-- AppointmentService
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'AppointmentService' AND column_name = 'id') THEN
    ALTER TABLE "AppointmentService" ADD COLUMN "id" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "AppointmentService" ALTER COLUMN "id" DROP DEFAULT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'AppointmentService' AND column_name = 'appointmentId') THEN
    ALTER TABLE "AppointmentService" ADD COLUMN "appointmentId" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "AppointmentService" ALTER COLUMN "appointmentId" DROP DEFAULT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'AppointmentService' AND column_name = 'serviceId') THEN
    ALTER TABLE "AppointmentService" ADD COLUMN "serviceId" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "AppointmentService" ALTER COLUMN "serviceId" DROP DEFAULT;
  END IF;
END $$;

-- Product
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Product' AND column_name = 'id') THEN
    ALTER TABLE "Product" ADD COLUMN "id" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "Product" ALTER COLUMN "id" DROP DEFAULT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Product' AND column_name = 'name') THEN
    ALTER TABLE "Product" ADD COLUMN "name" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "Product" ALTER COLUMN "name" DROP DEFAULT;
  END IF;
END $$;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "description" TEXT;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Product' AND column_name = 'price') THEN
    ALTER TABLE "Product" ADD COLUMN "price" DECIMAL(10,2) NOT NULL DEFAULT 0;
    ALTER TABLE "Product" ALTER COLUMN "price" DROP DEFAULT;
  END IF;
END $$;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "compareAtPrice" DECIMAL(10,2);
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "sku" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "trackInventory" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "stockQuantity" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "barcode" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "brand" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "unit" TEXT NOT NULL DEFAULT 'kos';
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "vatRate" DECIMAL(5,2);
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "forSale" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "reorderPoint" INTEGER;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "presetSeed" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "images" TEXT[];
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "categoryId" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "isFeatured" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Product' AND column_name = 'updatedAt') THEN
    ALTER TABLE "Product" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
    ALTER TABLE "Product" ALTER COLUMN "updatedAt" DROP DEFAULT;
  END IF;
END $$;

-- Order
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Order' AND column_name = 'id') THEN
    ALTER TABLE "Order" ADD COLUMN "id" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "Order" ALTER COLUMN "id" DROP DEFAULT;
  END IF;
END $$;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "customerId" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "guestName" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "guestEmail" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "guestPhone" TEXT;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Order' AND column_name = 'subtotal') THEN
    ALTER TABLE "Order" ADD COLUMN "subtotal" DECIMAL(10,2) NOT NULL DEFAULT 0;
    ALTER TABLE "Order" ALTER COLUMN "subtotal" DROP DEFAULT;
  END IF;
END $$;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "tax" DECIMAL(10,2) NOT NULL DEFAULT 0;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Order' AND column_name = 'total') THEN
    ALTER TABLE "Order" ADD COLUMN "total" DECIMAL(10,2) NOT NULL DEFAULT 0;
    ALTER TABLE "Order" ALTER COLUMN "total" DROP DEFAULT;
  END IF;
END $$;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "tipAmount" DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "tipMethod" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "status" "OrderStatus" NOT NULL DEFAULT 'PENDING';
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "paymentMethod" TEXT NOT NULL DEFAULT 'online';
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "stripePaymentIntentId" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "notes" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Order' AND column_name = 'updatedAt') THEN
    ALTER TABLE "Order" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
    ALTER TABLE "Order" ALTER COLUMN "updatedAt" DROP DEFAULT;
  END IF;
END $$;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;

-- OrderItem
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'OrderItem' AND column_name = 'id') THEN
    ALTER TABLE "OrderItem" ADD COLUMN "id" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "OrderItem" ALTER COLUMN "id" DROP DEFAULT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'OrderItem' AND column_name = 'orderId') THEN
    ALTER TABLE "OrderItem" ADD COLUMN "orderId" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "OrderItem" ALTER COLUMN "orderId" DROP DEFAULT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'OrderItem' AND column_name = 'productId') THEN
    ALTER TABLE "OrderItem" ADD COLUMN "productId" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "OrderItem" ALTER COLUMN "productId" DROP DEFAULT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'OrderItem' AND column_name = 'quantity') THEN
    ALTER TABLE "OrderItem" ADD COLUMN "quantity" INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE "OrderItem" ALTER COLUMN "quantity" DROP DEFAULT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'OrderItem' AND column_name = 'price') THEN
    ALTER TABLE "OrderItem" ADD COLUMN "price" DECIMAL(10,2) NOT NULL DEFAULT 0;
    ALTER TABLE "OrderItem" ALTER COLUMN "price" DROP DEFAULT;
  END IF;
END $$;

-- FormDefinition
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'FormDefinition' AND column_name = 'id') THEN
    ALTER TABLE "FormDefinition" ADD COLUMN "id" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "FormDefinition" ALTER COLUMN "id" DROP DEFAULT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'FormDefinition' AND column_name = 'organizationId') THEN
    ALTER TABLE "FormDefinition" ADD COLUMN "organizationId" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "FormDefinition" ALTER COLUMN "organizationId" DROP DEFAULT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'FormDefinition' AND column_name = 'key') THEN
    ALTER TABLE "FormDefinition" ADD COLUMN "key" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "FormDefinition" ALTER COLUMN "key" DROP DEFAULT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'FormDefinition' AND column_name = 'name') THEN
    ALTER TABLE "FormDefinition" ADD COLUMN "name" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "FormDefinition" ALTER COLUMN "name" DROP DEFAULT;
  END IF;
END $$;
ALTER TABLE "FormDefinition" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "FormDefinition" ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "FormDefinition" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'FormDefinition' AND column_name = 'fields') THEN
    ALTER TABLE "FormDefinition" ADD COLUMN "fields" JSONB NOT NULL DEFAULT '{}'::jsonb;
    ALTER TABLE "FormDefinition" ALTER COLUMN "fields" DROP DEFAULT;
  END IF;
END $$;
ALTER TABLE "FormDefinition" ADD COLUMN IF NOT EXISTS "sourceProfile" TEXT;
ALTER TABLE "FormDefinition" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'FormDefinition' AND column_name = 'updatedAt') THEN
    ALTER TABLE "FormDefinition" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
    ALTER TABLE "FormDefinition" ALTER COLUMN "updatedAt" DROP DEFAULT;
  END IF;
END $$;

-- FormSubmission
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'FormSubmission' AND column_name = 'id') THEN
    ALTER TABLE "FormSubmission" ADD COLUMN "id" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "FormSubmission" ALTER COLUMN "id" DROP DEFAULT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'FormSubmission' AND column_name = 'organizationId') THEN
    ALTER TABLE "FormSubmission" ADD COLUMN "organizationId" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "FormSubmission" ALTER COLUMN "organizationId" DROP DEFAULT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'FormSubmission' AND column_name = 'formDefinitionId') THEN
    ALTER TABLE "FormSubmission" ADD COLUMN "formDefinitionId" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "FormSubmission" ALTER COLUMN "formDefinitionId" DROP DEFAULT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'FormSubmission' AND column_name = 'data') THEN
    ALTER TABLE "FormSubmission" ADD COLUMN "data" JSONB NOT NULL DEFAULT '{}'::jsonb;
    ALTER TABLE "FormSubmission" ALTER COLUMN "data" DROP DEFAULT;
  END IF;
END $$;
ALTER TABLE "FormSubmission" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'NEW';
ALTER TABLE "FormSubmission" ADD COLUMN IF NOT EXISTS "customerId" TEXT;
ALTER TABLE "FormSubmission" ADD COLUMN IF NOT EXISTS "contextType" TEXT;
ALTER TABLE "FormSubmission" ADD COLUMN IF NOT EXISTS "contextId" TEXT;
ALTER TABLE "FormSubmission" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'FormSubmission' AND column_name = 'updatedAt') THEN
    ALTER TABLE "FormSubmission" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
    ALTER TABLE "FormSubmission" ALTER COLUMN "updatedAt" DROP DEFAULT;
  END IF;
END $$;

-- WorkflowDefinition
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'WorkflowDefinition' AND column_name = 'id') THEN
    ALTER TABLE "WorkflowDefinition" ADD COLUMN "id" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "WorkflowDefinition" ALTER COLUMN "id" DROP DEFAULT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'WorkflowDefinition' AND column_name = 'organizationId') THEN
    ALTER TABLE "WorkflowDefinition" ADD COLUMN "organizationId" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "WorkflowDefinition" ALTER COLUMN "organizationId" DROP DEFAULT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'WorkflowDefinition' AND column_name = 'key') THEN
    ALTER TABLE "WorkflowDefinition" ADD COLUMN "key" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "WorkflowDefinition" ALTER COLUMN "key" DROP DEFAULT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'WorkflowDefinition' AND column_name = 'name') THEN
    ALTER TABLE "WorkflowDefinition" ADD COLUMN "name" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "WorkflowDefinition" ALTER COLUMN "name" DROP DEFAULT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'WorkflowDefinition' AND column_name = 'entity') THEN
    ALTER TABLE "WorkflowDefinition" ADD COLUMN "entity" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "WorkflowDefinition" ALTER COLUMN "entity" DROP DEFAULT;
  END IF;
END $$;
ALTER TABLE "WorkflowDefinition" ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "WorkflowDefinition" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "WorkflowDefinition" ADD COLUMN IF NOT EXISTS "sourceProfile" TEXT;
ALTER TABLE "WorkflowDefinition" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'WorkflowDefinition' AND column_name = 'updatedAt') THEN
    ALTER TABLE "WorkflowDefinition" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
    ALTER TABLE "WorkflowDefinition" ALTER COLUMN "updatedAt" DROP DEFAULT;
  END IF;
END $$;

-- WorkflowStage
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'WorkflowStage' AND column_name = 'id') THEN
    ALTER TABLE "WorkflowStage" ADD COLUMN "id" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "WorkflowStage" ALTER COLUMN "id" DROP DEFAULT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'WorkflowStage' AND column_name = 'definitionId') THEN
    ALTER TABLE "WorkflowStage" ADD COLUMN "definitionId" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "WorkflowStage" ALTER COLUMN "definitionId" DROP DEFAULT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'WorkflowStage' AND column_name = 'key') THEN
    ALTER TABLE "WorkflowStage" ADD COLUMN "key" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "WorkflowStage" ALTER COLUMN "key" DROP DEFAULT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'WorkflowStage' AND column_name = 'name') THEN
    ALTER TABLE "WorkflowStage" ADD COLUMN "name" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "WorkflowStage" ALTER COLUMN "name" DROP DEFAULT;
  END IF;
END $$;
ALTER TABLE "WorkflowStage" ADD COLUMN IF NOT EXISTS "description" TEXT;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'WorkflowStage' AND column_name = 'order') THEN
    ALTER TABLE "WorkflowStage" ADD COLUMN "order" INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE "WorkflowStage" ALTER COLUMN "order" DROP DEFAULT;
  END IF;
END $$;
ALTER TABLE "WorkflowStage" ADD COLUMN IF NOT EXISTS "slaHours" INTEGER;
ALTER TABLE "WorkflowStage" ADD COLUMN IF NOT EXISTS "isFinal" BOOLEAN NOT NULL DEFAULT false;

-- WorkOrder
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'WorkOrder' AND column_name = 'id') THEN
    ALTER TABLE "WorkOrder" ADD COLUMN "id" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "WorkOrder" ALTER COLUMN "id" DROP DEFAULT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'WorkOrder' AND column_name = 'organizationId') THEN
    ALTER TABLE "WorkOrder" ADD COLUMN "organizationId" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "WorkOrder" ALTER COLUMN "organizationId" DROP DEFAULT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'WorkOrder' AND column_name = 'number') THEN
    ALTER TABLE "WorkOrder" ADD COLUMN "number" INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE "WorkOrder" ALTER COLUMN "number" DROP DEFAULT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'WorkOrder' AND column_name = 'title') THEN
    ALTER TABLE "WorkOrder" ADD COLUMN "title" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "WorkOrder" ALTER COLUMN "title" DROP DEFAULT;
  END IF;
END $$;
ALTER TABLE "WorkOrder" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'OPEN';
ALTER TABLE "WorkOrder" ADD COLUMN IF NOT EXISTS "priority" TEXT NOT NULL DEFAULT 'NORMAL';
ALTER TABLE "WorkOrder" ADD COLUMN IF NOT EXISTS "workflowDefinitionId" TEXT;
ALTER TABLE "WorkOrder" ADD COLUMN IF NOT EXISTS "currentStageKey" TEXT;
ALTER TABLE "WorkOrder" ADD COLUMN IF NOT EXISTS "dueDate" TIMESTAMP(3);
ALTER TABLE "WorkOrder" ADD COLUMN IF NOT EXISTS "total" DECIMAL(10,2);
ALTER TABLE "WorkOrder" ADD COLUMN IF NOT EXISTS "notes" TEXT;
ALTER TABLE "WorkOrder" ADD COLUMN IF NOT EXISTS "sourceSubmissionId" TEXT;
ALTER TABLE "WorkOrder" ADD COLUMN IF NOT EXISTS "linkedRecordId" TEXT;
ALTER TABLE "WorkOrder" ADD COLUMN IF NOT EXISTS "customerId" TEXT;
ALTER TABLE "WorkOrder" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'WorkOrder' AND column_name = 'updatedAt') THEN
    ALTER TABLE "WorkOrder" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
    ALTER TABLE "WorkOrder" ALTER COLUMN "updatedAt" DROP DEFAULT;
  END IF;
END $$;

-- WorkOrderEvent
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'WorkOrderEvent' AND column_name = 'id') THEN
    ALTER TABLE "WorkOrderEvent" ADD COLUMN "id" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "WorkOrderEvent" ALTER COLUMN "id" DROP DEFAULT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'WorkOrderEvent' AND column_name = 'organizationId') THEN
    ALTER TABLE "WorkOrderEvent" ADD COLUMN "organizationId" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "WorkOrderEvent" ALTER COLUMN "organizationId" DROP DEFAULT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'WorkOrderEvent' AND column_name = 'workOrderId') THEN
    ALTER TABLE "WorkOrderEvent" ADD COLUMN "workOrderId" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "WorkOrderEvent" ALTER COLUMN "workOrderId" DROP DEFAULT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'WorkOrderEvent' AND column_name = 'type') THEN
    ALTER TABLE "WorkOrderEvent" ADD COLUMN "type" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "WorkOrderEvent" ALTER COLUMN "type" DROP DEFAULT;
  END IF;
END $$;
ALTER TABLE "WorkOrderEvent" ADD COLUMN IF NOT EXISTS "fromStageKey" TEXT;
ALTER TABLE "WorkOrderEvent" ADD COLUMN IF NOT EXISTS "toStageKey" TEXT;
ALTER TABLE "WorkOrderEvent" ADD COLUMN IF NOT EXISTS "message" TEXT;
ALTER TABLE "WorkOrderEvent" ADD COLUMN IF NOT EXISTS "actorEmail" TEXT;
ALTER TABLE "WorkOrderEvent" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- ExtensionRecord
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'ExtensionRecord' AND column_name = 'id') THEN
    ALTER TABLE "ExtensionRecord" ADD COLUMN "id" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "ExtensionRecord" ALTER COLUMN "id" DROP DEFAULT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'ExtensionRecord' AND column_name = 'organizationId') THEN
    ALTER TABLE "ExtensionRecord" ADD COLUMN "organizationId" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "ExtensionRecord" ALTER COLUMN "organizationId" DROP DEFAULT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'ExtensionRecord' AND column_name = 'extensionId') THEN
    ALTER TABLE "ExtensionRecord" ADD COLUMN "extensionId" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "ExtensionRecord" ALTER COLUMN "extensionId" DROP DEFAULT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'ExtensionRecord' AND column_name = 'entityKey') THEN
    ALTER TABLE "ExtensionRecord" ADD COLUMN "entityKey" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "ExtensionRecord" ALTER COLUMN "entityKey" DROP DEFAULT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'ExtensionRecord' AND column_name = 'title') THEN
    ALTER TABLE "ExtensionRecord" ADD COLUMN "title" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "ExtensionRecord" ALTER COLUMN "title" DROP DEFAULT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'ExtensionRecord' AND column_name = 'data') THEN
    ALTER TABLE "ExtensionRecord" ADD COLUMN "data" JSONB NOT NULL DEFAULT '{}'::jsonb;
    ALTER TABLE "ExtensionRecord" ALTER COLUMN "data" DROP DEFAULT;
  END IF;
END $$;
ALTER TABLE "ExtensionRecord" ADD COLUMN IF NOT EXISTS "customerId" TEXT;
ALTER TABLE "ExtensionRecord" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'ExtensionRecord' AND column_name = 'updatedAt') THEN
    ALTER TABLE "ExtensionRecord" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
    ALTER TABLE "ExtensionRecord" ALTER COLUMN "updatedAt" DROP DEFAULT;
  END IF;
END $$;

-- ProductVariant
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'ProductVariant' AND column_name = 'id') THEN
    ALTER TABLE "ProductVariant" ADD COLUMN "id" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "ProductVariant" ALTER COLUMN "id" DROP DEFAULT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'ProductVariant' AND column_name = 'organizationId') THEN
    ALTER TABLE "ProductVariant" ADD COLUMN "organizationId" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "ProductVariant" ALTER COLUMN "organizationId" DROP DEFAULT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'ProductVariant' AND column_name = 'productId') THEN
    ALTER TABLE "ProductVariant" ADD COLUMN "productId" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "ProductVariant" ALTER COLUMN "productId" DROP DEFAULT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'ProductVariant' AND column_name = 'name') THEN
    ALTER TABLE "ProductVariant" ADD COLUMN "name" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "ProductVariant" ALTER COLUMN "name" DROP DEFAULT;
  END IF;
END $$;
ALTER TABLE "ProductVariant" ADD COLUMN IF NOT EXISTS "sku" TEXT;
ALTER TABLE "ProductVariant" ADD COLUMN IF NOT EXISTS "price" DECIMAL(10,2);
ALTER TABLE "ProductVariant" ADD COLUMN IF NOT EXISTS "trackInventory" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "ProductVariant" ADD COLUMN IF NOT EXISTS "stockQuantity" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ProductVariant" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "ProductVariant" ADD COLUMN IF NOT EXISTS "position" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ProductVariant" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'ProductVariant' AND column_name = 'updatedAt') THEN
    ALTER TABLE "ProductVariant" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
    ALTER TABLE "ProductVariant" ALTER COLUMN "updatedAt" DROP DEFAULT;
  END IF;
END $$;

-- Package
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Package' AND column_name = 'id') THEN
    ALTER TABLE "Package" ADD COLUMN "id" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "Package" ALTER COLUMN "id" DROP DEFAULT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Package' AND column_name = 'organizationId') THEN
    ALTER TABLE "Package" ADD COLUMN "organizationId" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "Package" ALTER COLUMN "organizationId" DROP DEFAULT;
  END IF;
END $$;
ALTER TABLE "Package" ADD COLUMN IF NOT EXISTS "kind" "PrepaidKind" NOT NULL DEFAULT 'PACKAGE';
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Package' AND column_name = 'name') THEN
    ALTER TABLE "Package" ADD COLUMN "name" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "Package" ALTER COLUMN "name" DROP DEFAULT;
  END IF;
END $$;
ALTER TABLE "Package" ADD COLUMN IF NOT EXISTS "description" TEXT;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Package' AND column_name = 'price') THEN
    ALTER TABLE "Package" ADD COLUMN "price" DECIMAL(10,2) NOT NULL DEFAULT 0;
    ALTER TABLE "Package" ALTER COLUMN "price" DROP DEFAULT;
  END IF;
END $$;
ALTER TABLE "Package" ADD COLUMN IF NOT EXISTS "compareAtPrice" DECIMAL(10,2);
ALTER TABLE "Package" ADD COLUMN IF NOT EXISTS "faceValue" DECIMAL(10,2);
ALTER TABLE "Package" ADD COLUMN IF NOT EXISTS "sessionCount" INTEGER;
ALTER TABLE "Package" ADD COLUMN IF NOT EXISTS "validityDays" INTEGER;
ALTER TABLE "Package" ADD COLUMN IF NOT EXISTS "serviceIds" TEXT[];
ALTER TABLE "Package" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Package" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Package' AND column_name = 'updatedAt') THEN
    ALTER TABLE "Package" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
    ALTER TABLE "Package" ALTER COLUMN "updatedAt" DROP DEFAULT;
  END IF;
END $$;

-- PrepaidPurchase
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'PrepaidPurchase' AND column_name = 'id') THEN
    ALTER TABLE "PrepaidPurchase" ADD COLUMN "id" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "PrepaidPurchase" ALTER COLUMN "id" DROP DEFAULT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'PrepaidPurchase' AND column_name = 'organizationId') THEN
    ALTER TABLE "PrepaidPurchase" ADD COLUMN "organizationId" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "PrepaidPurchase" ALTER COLUMN "organizationId" DROP DEFAULT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'PrepaidPurchase' AND column_name = 'prepaidProductId') THEN
    ALTER TABLE "PrepaidPurchase" ADD COLUMN "prepaidProductId" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "PrepaidPurchase" ALTER COLUMN "prepaidProductId" DROP DEFAULT;
  END IF;
END $$;
ALTER TABLE "PrepaidPurchase" ADD COLUMN IF NOT EXISTS "customerId" TEXT;
ALTER TABLE "PrepaidPurchase" ADD COLUMN IF NOT EXISTS "guestEmail" TEXT;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'PrepaidPurchase' AND column_name = 'code') THEN
    ALTER TABLE "PrepaidPurchase" ADD COLUMN "code" TEXT NOT NULL DEFAULT md5(random()::text || clock_timestamp()::text);
    ALTER TABLE "PrepaidPurchase" ALTER COLUMN "code" DROP DEFAULT;
  END IF;
END $$;
ALTER TABLE "PrepaidPurchase" ADD COLUMN IF NOT EXISTS "purchasedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "PrepaidPurchase" ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3);
ALTER TABLE "PrepaidPurchase" ADD COLUMN IF NOT EXISTS "balance" DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE "PrepaidPurchase" ADD COLUMN IF NOT EXISTS "sessionsLeft" INTEGER;
ALTER TABLE "PrepaidPurchase" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'PENDING';
ALTER TABLE "PrepaidPurchase" ADD COLUMN IF NOT EXISTS "stripeSessionId" TEXT;
ALTER TABLE "PrepaidPurchase" ADD COLUMN IF NOT EXISTS "note" TEXT;

-- PrepaidRedemption
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'PrepaidRedemption' AND column_name = 'id') THEN
    ALTER TABLE "PrepaidRedemption" ADD COLUMN "id" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "PrepaidRedemption" ALTER COLUMN "id" DROP DEFAULT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'PrepaidRedemption' AND column_name = 'prepaidPurchaseId') THEN
    ALTER TABLE "PrepaidRedemption" ADD COLUMN "prepaidPurchaseId" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "PrepaidRedemption" ALTER COLUMN "prepaidPurchaseId" DROP DEFAULT;
  END IF;
END $$;
ALTER TABLE "PrepaidRedemption" ADD COLUMN IF NOT EXISTS "appointmentId" TEXT;
ALTER TABLE "PrepaidRedemption" ADD COLUMN IF NOT EXISTS "orderId" TEXT;
ALTER TABLE "PrepaidRedemption" ADD COLUMN IF NOT EXISTS "amount" DECIMAL(10,2);
ALTER TABLE "PrepaidRedemption" ADD COLUMN IF NOT EXISTS "sessions" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "PrepaidRedemption" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- PackageItem
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'PackageItem' AND column_name = 'id') THEN
    ALTER TABLE "PackageItem" ADD COLUMN "id" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "PackageItem" ALTER COLUMN "id" DROP DEFAULT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'PackageItem' AND column_name = 'packageId') THEN
    ALTER TABLE "PackageItem" ADD COLUMN "packageId" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "PackageItem" ALTER COLUMN "packageId" DROP DEFAULT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'PackageItem' AND column_name = 'itemType') THEN
    ALTER TABLE "PackageItem" ADD COLUMN "itemType" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "PackageItem" ALTER COLUMN "itemType" DROP DEFAULT;
  END IF;
END $$;
ALTER TABLE "PackageItem" ADD COLUMN IF NOT EXISTS "serviceId" TEXT;
ALTER TABLE "PackageItem" ADD COLUMN IF NOT EXISTS "productId" TEXT;
ALTER TABLE "PackageItem" ADD COLUMN IF NOT EXISTS "quantity" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "PackageItem" ADD COLUMN IF NOT EXISTS "position" INTEGER NOT NULL DEFAULT 0;

-- Document
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Document' AND column_name = 'id') THEN
    ALTER TABLE "Document" ADD COLUMN "id" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "Document" ALTER COLUMN "id" DROP DEFAULT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Document' AND column_name = 'organizationId') THEN
    ALTER TABLE "Document" ADD COLUMN "organizationId" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "Document" ALTER COLUMN "organizationId" DROP DEFAULT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Document' AND column_name = 'type') THEN
    ALTER TABLE "Document" ADD COLUMN "type" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "Document" ALTER COLUMN "type" DROP DEFAULT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Document' AND column_name = 'number') THEN
    ALTER TABLE "Document" ADD COLUMN "number" INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE "Document" ALTER COLUMN "number" DROP DEFAULT;
  END IF;
END $$;
ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'DRAFT';
ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "customerId" TEXT;
ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "workOrderId" TEXT;
ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "issueDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "dueDate" TIMESTAMP(3);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Document' AND column_name = 'total') THEN
    ALTER TABLE "Document" ADD COLUMN "total" DECIMAL(10,2) NOT NULL DEFAULT 0;
    ALTER TABLE "Document" ALTER COLUMN "total" DROP DEFAULT;
  END IF;
END $$;
ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "notes" TEXT;
ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Document' AND column_name = 'updatedAt') THEN
    ALTER TABLE "Document" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
    ALTER TABLE "Document" ALTER COLUMN "updatedAt" DROP DEFAULT;
  END IF;
END $$;

-- DocumentItem
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'DocumentItem' AND column_name = 'id') THEN
    ALTER TABLE "DocumentItem" ADD COLUMN "id" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "DocumentItem" ALTER COLUMN "id" DROP DEFAULT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'DocumentItem' AND column_name = 'organizationId') THEN
    ALTER TABLE "DocumentItem" ADD COLUMN "organizationId" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "DocumentItem" ALTER COLUMN "organizationId" DROP DEFAULT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'DocumentItem' AND column_name = 'documentId') THEN
    ALTER TABLE "DocumentItem" ADD COLUMN "documentId" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "DocumentItem" ALTER COLUMN "documentId" DROP DEFAULT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'DocumentItem' AND column_name = 'description') THEN
    ALTER TABLE "DocumentItem" ADD COLUMN "description" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "DocumentItem" ALTER COLUMN "description" DROP DEFAULT;
  END IF;
END $$;
ALTER TABLE "DocumentItem" ADD COLUMN IF NOT EXISTS "quantity" DECIMAL(10,2) NOT NULL DEFAULT 1;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'DocumentItem' AND column_name = 'unitPrice') THEN
    ALTER TABLE "DocumentItem" ADD COLUMN "unitPrice" DECIMAL(10,2) NOT NULL DEFAULT 0;
    ALTER TABLE "DocumentItem" ALTER COLUMN "unitPrice" DROP DEFAULT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'DocumentItem' AND column_name = 'total') THEN
    ALTER TABLE "DocumentItem" ADD COLUMN "total" DECIMAL(10,2) NOT NULL DEFAULT 0;
    ALTER TABLE "DocumentItem" ALTER COLUMN "total" DROP DEFAULT;
  END IF;
END $$;
ALTER TABLE "DocumentItem" ADD COLUMN IF NOT EXISTS "position" INTEGER NOT NULL DEFAULT 0;

-- CustomDomain
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'CustomDomain' AND column_name = 'id') THEN
    ALTER TABLE "CustomDomain" ADD COLUMN "id" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "CustomDomain" ALTER COLUMN "id" DROP DEFAULT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'CustomDomain' AND column_name = 'organizationId') THEN
    ALTER TABLE "CustomDomain" ADD COLUMN "organizationId" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "CustomDomain" ALTER COLUMN "organizationId" DROP DEFAULT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'CustomDomain' AND column_name = 'domain') THEN
    ALTER TABLE "CustomDomain" ADD COLUMN "domain" TEXT NOT NULL DEFAULT md5(random()::text || clock_timestamp()::text);
    ALTER TABLE "CustomDomain" ALTER COLUMN "domain" DROP DEFAULT;
  END IF;
END $$;
ALTER TABLE "CustomDomain" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'PENDING';
ALTER TABLE "CustomDomain" ADD COLUMN IF NOT EXISTS "isPrimary" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "CustomDomain" ADD COLUMN IF NOT EXISTS "dnsRecords" JSONB;
ALTER TABLE "CustomDomain" ADD COLUMN IF NOT EXISTS "lastError" TEXT;
ALTER TABLE "CustomDomain" ADD COLUMN IF NOT EXISTS "lastCheckedAt" TIMESTAMP(3);
ALTER TABLE "CustomDomain" ADD COLUMN IF NOT EXISTS "verifiedAt" TIMESTAMP(3);
ALTER TABLE "CustomDomain" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'CustomDomain' AND column_name = 'updatedAt') THEN
    ALTER TABLE "CustomDomain" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
    ALTER TABLE "CustomDomain" ALTER COLUMN "updatedAt" DROP DEFAULT;
  END IF;
END $$;

-- StockMovement
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'StockMovement' AND column_name = 'id') THEN
    ALTER TABLE "StockMovement" ADD COLUMN "id" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "StockMovement" ALTER COLUMN "id" DROP DEFAULT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'StockMovement' AND column_name = 'organizationId') THEN
    ALTER TABLE "StockMovement" ADD COLUMN "organizationId" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "StockMovement" ALTER COLUMN "organizationId" DROP DEFAULT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'StockMovement' AND column_name = 'productId') THEN
    ALTER TABLE "StockMovement" ADD COLUMN "productId" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "StockMovement" ALTER COLUMN "productId" DROP DEFAULT;
  END IF;
END $$;
ALTER TABLE "StockMovement" ADD COLUMN IF NOT EXISTS "productVariantId" TEXT;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'StockMovement' AND column_name = 'direction') THEN
    ALTER TABLE "StockMovement" ADD COLUMN "direction" "StockDirection" NOT NULL DEFAULT 'IN';
    ALTER TABLE "StockMovement" ALTER COLUMN "direction" DROP DEFAULT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'StockMovement' AND column_name = 'quantity') THEN
    ALTER TABLE "StockMovement" ADD COLUMN "quantity" INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE "StockMovement" ALTER COLUMN "quantity" DROP DEFAULT;
  END IF;
END $$;
ALTER TABLE "StockMovement" ADD COLUMN IF NOT EXISTS "source" "StockMovementSource" NOT NULL DEFAULT 'MANUAL';
ALTER TABLE "StockMovement" ADD COLUMN IF NOT EXISTS "note" TEXT;
ALTER TABLE "StockMovement" ADD COLUMN IF NOT EXISTS "orderId" TEXT;
ALTER TABLE "StockMovement" ADD COLUMN IF NOT EXISTS "supplierRecordId" TEXT;
ALTER TABLE "StockMovement" ADD COLUMN IF NOT EXISTS "batchRecordId" TEXT;
ALTER TABLE "StockMovement" ADD COLUMN IF NOT EXISTS "createdById" TEXT;
ALTER TABLE "StockMovement" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Project
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Project' AND column_name = 'id') THEN
    ALTER TABLE "Project" ADD COLUMN "id" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "Project" ALTER COLUMN "id" DROP DEFAULT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Project' AND column_name = 'organizationId') THEN
    ALTER TABLE "Project" ADD COLUMN "organizationId" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "Project" ALTER COLUMN "organizationId" DROP DEFAULT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Project' AND column_name = 'name') THEN
    ALTER TABLE "Project" ADD COLUMN "name" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "Project" ALTER COLUMN "name" DROP DEFAULT;
  END IF;
END $$;
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "status" "ProjectStatus" NOT NULL DEFAULT 'PLANNING';
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "startDate" TIMESTAMP(3);
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "deadline" TIMESTAMP(3);
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "budget" DECIMAL(10,2);
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "notes" TEXT;
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "customerId" TEXT;
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "workOrderId" TEXT;
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "createdById" TEXT;
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Project' AND column_name = 'updatedAt') THEN
    ALTER TABLE "Project" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
    ALTER TABLE "Project" ALTER COLUMN "updatedAt" DROP DEFAULT;
  END IF;
END $$;

-- ProjectTask
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'ProjectTask' AND column_name = 'id') THEN
    ALTER TABLE "ProjectTask" ADD COLUMN "id" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "ProjectTask" ALTER COLUMN "id" DROP DEFAULT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'ProjectTask' AND column_name = 'organizationId') THEN
    ALTER TABLE "ProjectTask" ADD COLUMN "organizationId" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "ProjectTask" ALTER COLUMN "organizationId" DROP DEFAULT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'ProjectTask' AND column_name = 'projectId') THEN
    ALTER TABLE "ProjectTask" ADD COLUMN "projectId" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "ProjectTask" ALTER COLUMN "projectId" DROP DEFAULT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'ProjectTask' AND column_name = 'title') THEN
    ALTER TABLE "ProjectTask" ADD COLUMN "title" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "ProjectTask" ALTER COLUMN "title" DROP DEFAULT;
  END IF;
END $$;
ALTER TABLE "ProjectTask" ADD COLUMN IF NOT EXISTS "status" "ProjectTaskStatus" NOT NULL DEFAULT 'OPEN';
ALTER TABLE "ProjectTask" ADD COLUMN IF NOT EXISTS "dueDate" TIMESTAMP(3);
ALTER TABLE "ProjectTask" ADD COLUMN IF NOT EXISTS "assigneeName" TEXT;
ALTER TABLE "ProjectTask" ADD COLUMN IF NOT EXISTS "hoursEst" DOUBLE PRECISION;
ALTER TABLE "ProjectTask" ADD COLUMN IF NOT EXISTS "notes" TEXT;
ALTER TABLE "ProjectTask" ADD COLUMN IF NOT EXISTS "position" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ProjectTask" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'ProjectTask' AND column_name = 'updatedAt') THEN
    ALTER TABLE "ProjectTask" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
    ALTER TABLE "ProjectTask" ALTER COLUMN "updatedAt" DROP DEFAULT;
  END IF;
END $$;

-- ConfigChangeLog
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'ConfigChangeLog' AND column_name = 'id') THEN
    ALTER TABLE "ConfigChangeLog" ADD COLUMN "id" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "ConfigChangeLog" ALTER COLUMN "id" DROP DEFAULT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'ConfigChangeLog' AND column_name = 'organizationId') THEN
    ALTER TABLE "ConfigChangeLog" ADD COLUMN "organizationId" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "ConfigChangeLog" ALTER COLUMN "organizationId" DROP DEFAULT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'ConfigChangeLog' AND column_name = 'entityKey') THEN
    ALTER TABLE "ConfigChangeLog" ADD COLUMN "entityKey" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "ConfigChangeLog" ALTER COLUMN "entityKey" DROP DEFAULT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'ConfigChangeLog' AND column_name = 'version') THEN
    ALTER TABLE "ConfigChangeLog" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE "ConfigChangeLog" ALTER COLUMN "version" DROP DEFAULT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'ConfigChangeLog' AND column_name = 'actorEmail') THEN
    ALTER TABLE "ConfigChangeLog" ADD COLUMN "actorEmail" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "ConfigChangeLog" ALTER COLUMN "actorEmail" DROP DEFAULT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'ConfigChangeLog' AND column_name = 'action') THEN
    ALTER TABLE "ConfigChangeLog" ADD COLUMN "action" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "ConfigChangeLog" ALTER COLUMN "action" DROP DEFAULT;
  END IF;
END $$;
ALTER TABLE "ConfigChangeLog" ADD COLUMN IF NOT EXISTS "summary" TEXT;
ALTER TABLE "ConfigChangeLog" ADD COLUMN IF NOT EXISTS "previous" JSONB;
ALTER TABLE "ConfigChangeLog" ADD COLUMN IF NOT EXISTS "next" JSONB;
ALTER TABLE "ConfigChangeLog" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- JobRun
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'JobRun' AND column_name = 'id') THEN
    ALTER TABLE "JobRun" ADD COLUMN "id" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "JobRun" ALTER COLUMN "id" DROP DEFAULT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'JobRun' AND column_name = 'job') THEN
    ALTER TABLE "JobRun" ADD COLUMN "job" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "JobRun" ALTER COLUMN "job" DROP DEFAULT;
  END IF;
END $$;
ALTER TABLE "JobRun" ADD COLUMN IF NOT EXISTS "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "JobRun" ADD COLUMN IF NOT EXISTS "finishedAt" TIMESTAMP(3);
ALTER TABLE "JobRun" ADD COLUMN IF NOT EXISTS "ok" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "JobRun" ADD COLUMN IF NOT EXISTS "sent" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "JobRun" ADD COLUMN IF NOT EXISTS "failed" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "JobRun" ADD COLUMN IF NOT EXISTS "detail" JSONB;

-- ========== 3) INDEKSI (CREATE INDEX IF NOT EXISTS) ==========
CREATE INDEX IF NOT EXISTS "Account_userId_idx" ON "Account"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");
CREATE UNIQUE INDEX IF NOT EXISTS "Session_sessionToken_key" ON "Session"("sessionToken");
CREATE INDEX IF NOT EXISTS "Session_userId_idx" ON "Session"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "Organization_slug_key" ON "Organization"("slug");
CREATE INDEX IF NOT EXISTS "Organization_slug_idx" ON "Organization"("slug");
CREATE INDEX IF NOT EXISTS "Organization_status_idx" ON "Organization"("status");
CREATE UNIQUE INDEX IF NOT EXISTS "PlatformSubscription_organizationId_key" ON "PlatformSubscription"("organizationId");
CREATE UNIQUE INDEX IF NOT EXISTS "PlatformSubscription_stripeSubscriptionId_key" ON "PlatformSubscription"("stripeSubscriptionId");
CREATE INDEX IF NOT EXISTS "PlatformSubscription_status_idx" ON "PlatformSubscription"("status");
CREATE UNIQUE INDEX IF NOT EXISTS "PlatformBillingEvent_stripeEventId_key" ON "PlatformBillingEvent"("stripeEventId");
CREATE INDEX IF NOT EXISTS "PlatformBillingEvent_organizationId_createdAt_idx" ON "PlatformBillingEvent"("organizationId", "createdAt");
CREATE INDEX IF NOT EXISTS "PlatformAuditLog_organizationId_createdAt_idx" ON "PlatformAuditLog"("organizationId", "createdAt");
CREATE INDEX IF NOT EXISTS "PlatformAuditLog_action_createdAt_idx" ON "PlatformAuditLog"("action", "createdAt");
CREATE INDEX IF NOT EXISTS "PlatformWebhookFailure_createdAt_idx" ON "PlatformWebhookFailure"("createdAt");
CREATE INDEX IF NOT EXISTS "PlatformWebhookFailure_reason_createdAt_idx" ON "PlatformWebhookFailure"("reason", "createdAt");
CREATE INDEX IF NOT EXISTS "Media_organizationId_idx" ON "Media"("organizationId");
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX IF NOT EXISTS "User_resetToken_key" ON "User"("resetToken");
CREATE INDEX IF NOT EXISTS "User_email_idx" ON "User"("email");
CREATE INDEX IF NOT EXISTS "User_role_idx" ON "User"("role");
CREATE INDEX IF NOT EXISTS "User_customRoleId_idx" ON "User"("customRoleId");
CREATE UNIQUE INDEX IF NOT EXISTS "NotificationPreferences_userId_key" ON "NotificationPreferences"("userId");
CREATE INDEX IF NOT EXISTS "CustomRole_organizationId_idx" ON "CustomRole"("organizationId");
CREATE UNIQUE INDEX IF NOT EXISTS "VerificationToken_token_key" ON "VerificationToken"("token");
CREATE UNIQUE INDEX IF NOT EXISTS "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");
CREATE UNIQUE INDEX IF NOT EXISTS "SalonConfig_organizationId_key" ON "SalonConfig"("organizationId");
CREATE INDEX IF NOT EXISTS "Category_organizationId_idx" ON "Category"("organizationId");
CREATE INDEX IF NOT EXISTS "Category_slug_idx" ON "Category"("slug");
CREATE UNIQUE INDEX IF NOT EXISTS "Category_organizationId_slug_key" ON "Category"("organizationId", "slug");
CREATE INDEX IF NOT EXISTS "Service_organizationId_idx" ON "Service"("organizationId");
CREATE INDEX IF NOT EXISTS "Service_categoryId_idx" ON "Service"("categoryId");
CREATE INDEX IF NOT EXISTS "Service_isActive_idx" ON "Service"("isActive");
CREATE INDEX IF NOT EXISTS "Service_isFeatured_idx" ON "Service"("isFeatured");
CREATE UNIQUE INDEX IF NOT EXISTS "Service_organizationId_slug_key" ON "Service"("organizationId", "slug");
CREATE INDEX IF NOT EXISTS "Review_serviceId_idx" ON "Review"("serviceId");
CREATE INDEX IF NOT EXISTS "Review_userId_idx" ON "Review"("userId");
CREATE INDEX IF NOT EXISTS "Review_isActive_idx" ON "Review"("isActive");
CREATE INDEX IF NOT EXISTS "Review_organizationId_idx" ON "Review"("organizationId");
CREATE INDEX IF NOT EXISTS "ServiceGallery_serviceId_idx" ON "ServiceGallery"("serviceId");
CREATE INDEX IF NOT EXISTS "ServiceFAQ_serviceId_idx" ON "ServiceFAQ"("serviceId");
CREATE UNIQUE INDEX IF NOT EXISTS "Staff_userId_key" ON "Staff"("userId");
CREATE INDEX IF NOT EXISTS "Staff_userId_idx" ON "Staff"("userId");
CREATE INDEX IF NOT EXISTS "Staff_organizationId_idx" ON "Staff"("organizationId");
CREATE INDEX IF NOT EXISTS "Staff_isActive_idx" ON "Staff"("isActive");
CREATE INDEX IF NOT EXISTS "Staff_email_idx" ON "Staff"("email");
CREATE INDEX IF NOT EXISTS "StaffService_staffId_idx" ON "StaffService"("staffId");
CREATE INDEX IF NOT EXISTS "StaffService_serviceId_idx" ON "StaffService"("serviceId");
CREATE UNIQUE INDEX IF NOT EXISTS "StaffService_staffId_serviceId_key" ON "StaffService"("staffId", "serviceId");
CREATE INDEX IF NOT EXISTS "WorkingHours_staffId_idx" ON "WorkingHours"("staffId");
CREATE UNIQUE INDEX IF NOT EXISTS "WorkingHours_staffId_dayOfWeek_key" ON "WorkingHours"("staffId", "dayOfWeek");
CREATE UNIQUE INDEX IF NOT EXISTS "Customer_userId_key" ON "Customer"("userId");
CREATE INDEX IF NOT EXISTS "Customer_userId_idx" ON "Customer"("userId");
CREATE INDEX IF NOT EXISTS "Customer_organizationId_idx" ON "Customer"("organizationId");
CREATE INDEX IF NOT EXISTS "Customer_email_idx" ON "Customer"("email");
CREATE INDEX IF NOT EXISTS "Customer_phone_idx" ON "Customer"("phone");
CREATE INDEX IF NOT EXISTS "WaitlistEntry_organizationId_status_idx" ON "WaitlistEntry"("organizationId", "status");
CREATE INDEX IF NOT EXISTS "WaitlistEntry_serviceId_idx" ON "WaitlistEntry"("serviceId");
CREATE INDEX IF NOT EXISTS "ServiceAddon_serviceId_isActive_idx" ON "ServiceAddon"("serviceId", "isActive");
CREATE UNIQUE INDEX IF NOT EXISTS "MarketingCampaign_organizationId_kind_key" ON "MarketingCampaign"("organizationId", "kind");
CREATE INDEX IF NOT EXISTS "CampaignSend_campaignId_sentAt_idx" ON "CampaignSend"("campaignId", "sentAt");
CREATE UNIQUE INDEX IF NOT EXISTS "CampaignSend_campaignId_email_triggerKey_key" ON "CampaignSend"("campaignId", "email", "triggerKey");
CREATE UNIQUE INDEX IF NOT EXISTS "WalkInEntry_ticketCode_key" ON "WalkInEntry"("ticketCode");
CREATE INDEX IF NOT EXISTS "WalkInEntry_organizationId_status_createdAt_idx" ON "WalkInEntry"("organizationId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "MarketingUnsubscribe_email_idx" ON "MarketingUnsubscribe"("email");
CREATE UNIQUE INDEX IF NOT EXISTS "MarketingUnsubscribe_organizationId_email_key" ON "MarketingUnsubscribe"("organizationId", "email");
CREATE UNIQUE INDEX IF NOT EXISTS "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");
CREATE INDEX IF NOT EXISTS "PushSubscription_userId_idx" ON "PushSubscription"("userId");
CREATE INDEX IF NOT EXISTS "PushSubscription_organizationId_idx" ON "PushSubscription"("organizationId");
CREATE INDEX IF NOT EXISTS "OrganizationMember_userId_idx" ON "OrganizationMember"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "OrganizationMember_organizationId_userId_key" ON "OrganizationMember"("organizationId", "userId");
CREATE INDEX IF NOT EXISTS "OrganizationModuleState_organizationId_idx" ON "OrganizationModuleState"("organizationId");
CREATE UNIQUE INDEX IF NOT EXISTS "OrganizationModuleState_organizationId_moduleId_key" ON "OrganizationModuleState"("organizationId", "moduleId");
CREATE UNIQUE INDEX IF NOT EXISTS "Appointment_stripePaymentId_key" ON "Appointment"("stripePaymentId");
CREATE UNIQUE INDEX IF NOT EXISTS "Appointment_intakeToken_key" ON "Appointment"("intakeToken");
CREATE UNIQUE INDEX IF NOT EXISTS "Appointment_noShowChargeId_key" ON "Appointment"("noShowChargeId");
CREATE INDEX IF NOT EXISTS "Appointment_staffId_idx" ON "Appointment"("staffId");
CREATE INDEX IF NOT EXISTS "Appointment_customerId_idx" ON "Appointment"("customerId");
CREATE INDEX IF NOT EXISTS "Appointment_organizationId_idx" ON "Appointment"("organizationId");
CREATE INDEX IF NOT EXISTS "Appointment_startTime_idx" ON "Appointment"("startTime");
CREATE INDEX IF NOT EXISTS "Appointment_status_idx" ON "Appointment"("status");
CREATE INDEX IF NOT EXISTS "Appointment_depositPaid_idx" ON "Appointment"("depositPaid");
CREATE INDEX IF NOT EXISTS "AppointmentService_appointmentId_idx" ON "AppointmentService"("appointmentId");
CREATE INDEX IF NOT EXISTS "AppointmentService_serviceId_idx" ON "AppointmentService"("serviceId");
CREATE UNIQUE INDEX IF NOT EXISTS "AppointmentService_appointmentId_serviceId_key" ON "AppointmentService"("appointmentId", "serviceId");
CREATE INDEX IF NOT EXISTS "Product_organizationId_idx" ON "Product"("organizationId");
CREATE INDEX IF NOT EXISTS "Product_categoryId_idx" ON "Product"("categoryId");
CREATE INDEX IF NOT EXISTS "Product_isActive_idx" ON "Product"("isActive");
CREATE INDEX IF NOT EXISTS "Product_isFeatured_idx" ON "Product"("isFeatured");
CREATE INDEX IF NOT EXISTS "Product_organizationId_forSale_idx" ON "Product"("organizationId", "forSale");
CREATE UNIQUE INDEX IF NOT EXISTS "Product_organizationId_sku_key" ON "Product"("organizationId", "sku");
CREATE UNIQUE INDEX IF NOT EXISTS "Product_organizationId_barcode_key" ON "Product"("organizationId", "barcode");
CREATE INDEX IF NOT EXISTS "Order_customerId_idx" ON "Order"("customerId");
CREATE INDEX IF NOT EXISTS "Order_organizationId_idx" ON "Order"("organizationId");
CREATE INDEX IF NOT EXISTS "Order_status_idx" ON "Order"("status");
CREATE INDEX IF NOT EXISTS "Order_createdAt_idx" ON "Order"("createdAt");
CREATE INDEX IF NOT EXISTS "OrderItem_orderId_idx" ON "OrderItem"("orderId");
CREATE INDEX IF NOT EXISTS "OrderItem_productId_idx" ON "OrderItem"("productId");
CREATE INDEX IF NOT EXISTS "FormDefinition_organizationId_idx" ON "FormDefinition"("organizationId");
CREATE UNIQUE INDEX IF NOT EXISTS "FormDefinition_organizationId_key_key" ON "FormDefinition"("organizationId", "key");
CREATE INDEX IF NOT EXISTS "FormSubmission_organizationId_idx" ON "FormSubmission"("organizationId");
CREATE INDEX IF NOT EXISTS "FormSubmission_formDefinitionId_idx" ON "FormSubmission"("formDefinitionId");
CREATE INDEX IF NOT EXISTS "FormSubmission_customerId_idx" ON "FormSubmission"("customerId");
CREATE INDEX IF NOT EXISTS "FormSubmission_contextType_contextId_idx" ON "FormSubmission"("contextType", "contextId");
CREATE UNIQUE INDEX IF NOT EXISTS "FormSubmission_formDefinitionId_contextType_contextId_key" ON "FormSubmission"("formDefinitionId", "contextType", "contextId");
CREATE INDEX IF NOT EXISTS "WorkflowDefinition_organizationId_idx" ON "WorkflowDefinition"("organizationId");
CREATE UNIQUE INDEX IF NOT EXISTS "WorkflowDefinition_organizationId_key_key" ON "WorkflowDefinition"("organizationId", "key");
CREATE INDEX IF NOT EXISTS "WorkflowStage_definitionId_idx" ON "WorkflowStage"("definitionId");
CREATE UNIQUE INDEX IF NOT EXISTS "WorkflowStage_definitionId_key_key" ON "WorkflowStage"("definitionId", "key");
CREATE UNIQUE INDEX IF NOT EXISTS "WorkOrder_sourceSubmissionId_key" ON "WorkOrder"("sourceSubmissionId");
CREATE UNIQUE INDEX IF NOT EXISTS "WorkOrder_linkedRecordId_key" ON "WorkOrder"("linkedRecordId");
CREATE INDEX IF NOT EXISTS "WorkOrder_organizationId_idx" ON "WorkOrder"("organizationId");
CREATE INDEX IF NOT EXISTS "WorkOrder_organizationId_status_idx" ON "WorkOrder"("organizationId", "status");
CREATE INDEX IF NOT EXISTS "WorkOrder_customerId_idx" ON "WorkOrder"("customerId");
CREATE INDEX IF NOT EXISTS "WorkOrder_dueDate_idx" ON "WorkOrder"("dueDate");
CREATE UNIQUE INDEX IF NOT EXISTS "WorkOrder_organizationId_number_key" ON "WorkOrder"("organizationId", "number");
CREATE INDEX IF NOT EXISTS "WorkOrderEvent_organizationId_idx" ON "WorkOrderEvent"("organizationId");
CREATE INDEX IF NOT EXISTS "WorkOrderEvent_workOrderId_createdAt_idx" ON "WorkOrderEvent"("workOrderId", "createdAt");
CREATE INDEX IF NOT EXISTS "ExtensionRecord_organizationId_idx" ON "ExtensionRecord"("organizationId");
CREATE INDEX IF NOT EXISTS "ExtensionRecord_organizationId_entityKey_idx" ON "ExtensionRecord"("organizationId", "entityKey");
CREATE INDEX IF NOT EXISTS "ExtensionRecord_customerId_idx" ON "ExtensionRecord"("customerId");
CREATE INDEX IF NOT EXISTS "ProductVariant_organizationId_idx" ON "ProductVariant"("organizationId");
CREATE INDEX IF NOT EXISTS "ProductVariant_productId_idx" ON "ProductVariant"("productId");
CREATE UNIQUE INDEX IF NOT EXISTS "ProductVariant_organizationId_sku_key" ON "ProductVariant"("organizationId", "sku");
CREATE INDEX IF NOT EXISTS "Package_organizationId_idx" ON "Package"("organizationId");
CREATE INDEX IF NOT EXISTS "Package_organizationId_kind_idx" ON "Package"("organizationId", "kind");
CREATE INDEX IF NOT EXISTS "Package_isActive_idx" ON "Package"("isActive");
CREATE UNIQUE INDEX IF NOT EXISTS "PrepaidPurchase_code_key" ON "PrepaidPurchase"("code");
CREATE INDEX IF NOT EXISTS "PrepaidPurchase_organizationId_idx" ON "PrepaidPurchase"("organizationId");
CREATE INDEX IF NOT EXISTS "PrepaidPurchase_organizationId_status_idx" ON "PrepaidPurchase"("organizationId", "status");
CREATE INDEX IF NOT EXISTS "PrepaidPurchase_prepaidProductId_idx" ON "PrepaidPurchase"("prepaidProductId");
CREATE INDEX IF NOT EXISTS "PrepaidPurchase_customerId_idx" ON "PrepaidPurchase"("customerId");
CREATE INDEX IF NOT EXISTS "PrepaidRedemption_prepaidPurchaseId_idx" ON "PrepaidRedemption"("prepaidPurchaseId");
CREATE INDEX IF NOT EXISTS "PrepaidRedemption_orderId_idx" ON "PrepaidRedemption"("orderId");
CREATE INDEX IF NOT EXISTS "PrepaidRedemption_appointmentId_idx" ON "PrepaidRedemption"("appointmentId");
CREATE UNIQUE INDEX IF NOT EXISTS "PrepaidRedemption_prepaidPurchaseId_orderId_key" ON "PrepaidRedemption"("prepaidPurchaseId", "orderId");
CREATE UNIQUE INDEX IF NOT EXISTS "PrepaidRedemption_prepaidPurchaseId_appointmentId_key" ON "PrepaidRedemption"("prepaidPurchaseId", "appointmentId");
CREATE INDEX IF NOT EXISTS "PackageItem_packageId_idx" ON "PackageItem"("packageId");
CREATE INDEX IF NOT EXISTS "PackageItem_serviceId_idx" ON "PackageItem"("serviceId");
CREATE INDEX IF NOT EXISTS "PackageItem_productId_idx" ON "PackageItem"("productId");
CREATE INDEX IF NOT EXISTS "Document_organizationId_idx" ON "Document"("organizationId");
CREATE INDEX IF NOT EXISTS "Document_organizationId_type_status_idx" ON "Document"("organizationId", "type", "status");
CREATE INDEX IF NOT EXISTS "Document_customerId_idx" ON "Document"("customerId");
CREATE INDEX IF NOT EXISTS "Document_workOrderId_idx" ON "Document"("workOrderId");
CREATE UNIQUE INDEX IF NOT EXISTS "Document_organizationId_type_number_key" ON "Document"("organizationId", "type", "number");
CREATE INDEX IF NOT EXISTS "DocumentItem_documentId_idx" ON "DocumentItem"("documentId");
CREATE INDEX IF NOT EXISTS "DocumentItem_organizationId_idx" ON "DocumentItem"("organizationId");
CREATE UNIQUE INDEX IF NOT EXISTS "CustomDomain_domain_key" ON "CustomDomain"("domain");
CREATE INDEX IF NOT EXISTS "CustomDomain_organizationId_idx" ON "CustomDomain"("organizationId");
CREATE INDEX IF NOT EXISTS "CustomDomain_organizationId_status_idx" ON "CustomDomain"("organizationId", "status");
CREATE INDEX IF NOT EXISTS "StockMovement_organizationId_idx" ON "StockMovement"("organizationId");
CREATE INDEX IF NOT EXISTS "StockMovement_organizationId_productId_idx" ON "StockMovement"("organizationId", "productId");
CREATE INDEX IF NOT EXISTS "StockMovement_productId_idx" ON "StockMovement"("productId");
CREATE INDEX IF NOT EXISTS "StockMovement_createdAt_idx" ON "StockMovement"("createdAt");
CREATE INDEX IF NOT EXISTS "Project_organizationId_idx" ON "Project"("organizationId");
CREATE INDEX IF NOT EXISTS "Project_organizationId_status_idx" ON "Project"("organizationId", "status");
CREATE INDEX IF NOT EXISTS "Project_customerId_idx" ON "Project"("customerId");
CREATE INDEX IF NOT EXISTS "Project_workOrderId_idx" ON "Project"("workOrderId");
CREATE INDEX IF NOT EXISTS "Project_deadline_idx" ON "Project"("deadline");
CREATE INDEX IF NOT EXISTS "ProjectTask_organizationId_idx" ON "ProjectTask"("organizationId");
CREATE INDEX IF NOT EXISTS "ProjectTask_projectId_idx" ON "ProjectTask"("projectId");
CREATE INDEX IF NOT EXISTS "ProjectTask_projectId_position_idx" ON "ProjectTask"("projectId", "position");
CREATE INDEX IF NOT EXISTS "ConfigChangeLog_organizationId_createdAt_idx" ON "ConfigChangeLog"("organizationId", "createdAt");
CREATE INDEX IF NOT EXISTS "ConfigChangeLog_organizationId_entityKey_idx" ON "ConfigChangeLog"("organizationId", "entityKey");
CREATE UNIQUE INDEX IF NOT EXISTS "ConfigChangeLog_organizationId_entityKey_version_key" ON "ConfigChangeLog"("organizationId", "entityKey", "version");
CREATE INDEX IF NOT EXISTS "JobRun_job_startedAt_idx" ON "JobRun"("job", "startedAt");

-- ========== 4) TUJI KLJUČI (pg_constraint probe) ==========
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Account_userId_fkey') THEN
    ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Session_userId_fkey') THEN
    ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PlatformSubscription_organizationId_fkey') THEN
    ALTER TABLE "PlatformSubscription" ADD CONSTRAINT "PlatformSubscription_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PlatformBillingEvent_organizationId_fkey') THEN
    ALTER TABLE "PlatformBillingEvent" ADD CONSTRAINT "PlatformBillingEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PlatformBillingEvent_subscriptionId_fkey') THEN
    ALTER TABLE "PlatformBillingEvent" ADD CONSTRAINT "PlatformBillingEvent_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "PlatformSubscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PlatformAuditLog_organizationId_fkey') THEN
    ALTER TABLE "PlatformAuditLog" ADD CONSTRAINT "PlatformAuditLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Media_organizationId_fkey') THEN
    ALTER TABLE "Media" ADD CONSTRAINT "Media_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'User_organizationId_fkey') THEN
    ALTER TABLE "User" ADD CONSTRAINT "User_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'User_customRoleId_fkey') THEN
    ALTER TABLE "User" ADD CONSTRAINT "User_customRoleId_fkey" FOREIGN KEY ("customRoleId") REFERENCES "CustomRole"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'NotificationPreferences_userId_fkey') THEN
    ALTER TABLE "NotificationPreferences" ADD CONSTRAINT "NotificationPreferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CustomRole_organizationId_fkey') THEN
    ALTER TABLE "CustomRole" ADD CONSTRAINT "CustomRole_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SalonConfig_organizationId_fkey') THEN
    ALTER TABLE "SalonConfig" ADD CONSTRAINT "SalonConfig_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Category_organizationId_fkey') THEN
    ALTER TABLE "Category" ADD CONSTRAINT "Category_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Service_intakeFormDefinitionId_fkey') THEN
    ALTER TABLE "Service" ADD CONSTRAINT "Service_intakeFormDefinitionId_fkey" FOREIGN KEY ("intakeFormDefinitionId") REFERENCES "FormDefinition"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Service_organizationId_fkey') THEN
    ALTER TABLE "Service" ADD CONSTRAINT "Service_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Service_categoryId_fkey') THEN
    ALTER TABLE "Service" ADD CONSTRAINT "Service_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Review_serviceId_fkey') THEN
    ALTER TABLE "Review" ADD CONSTRAINT "Review_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Review_organizationId_fkey') THEN
    ALTER TABLE "Review" ADD CONSTRAINT "Review_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Review_userId_fkey') THEN
    ALTER TABLE "Review" ADD CONSTRAINT "Review_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ServiceGallery_serviceId_fkey') THEN
    ALTER TABLE "ServiceGallery" ADD CONSTRAINT "ServiceGallery_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ServiceFAQ_serviceId_fkey') THEN
    ALTER TABLE "ServiceFAQ" ADD CONSTRAINT "ServiceFAQ_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Staff_userId_fkey') THEN
    ALTER TABLE "Staff" ADD CONSTRAINT "Staff_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Staff_organizationId_fkey') THEN
    ALTER TABLE "Staff" ADD CONSTRAINT "Staff_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StaffService_staffId_fkey') THEN
    ALTER TABLE "StaffService" ADD CONSTRAINT "StaffService_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StaffService_serviceId_fkey') THEN
    ALTER TABLE "StaffService" ADD CONSTRAINT "StaffService_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'WorkingHours_staffId_fkey') THEN
    ALTER TABLE "WorkingHours" ADD CONSTRAINT "WorkingHours_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Customer_userId_fkey') THEN
    ALTER TABLE "Customer" ADD CONSTRAINT "Customer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Customer_organizationId_fkey') THEN
    ALTER TABLE "Customer" ADD CONSTRAINT "Customer_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'WaitlistEntry_organizationId_fkey') THEN
    ALTER TABLE "WaitlistEntry" ADD CONSTRAINT "WaitlistEntry_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'WaitlistEntry_serviceId_fkey') THEN
    ALTER TABLE "WaitlistEntry" ADD CONSTRAINT "WaitlistEntry_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ServiceAddon_serviceId_fkey') THEN
    ALTER TABLE "ServiceAddon" ADD CONSTRAINT "ServiceAddon_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MarketingCampaign_organizationId_fkey') THEN
    ALTER TABLE "MarketingCampaign" ADD CONSTRAINT "MarketingCampaign_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CampaignSend_campaignId_fkey') THEN
    ALTER TABLE "CampaignSend" ADD CONSTRAINT "CampaignSend_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "MarketingCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'WalkInEntry_organizationId_fkey') THEN
    ALTER TABLE "WalkInEntry" ADD CONSTRAINT "WalkInEntry_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'WalkInEntry_serviceId_fkey') THEN
    ALTER TABLE "WalkInEntry" ADD CONSTRAINT "WalkInEntry_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MarketingUnsubscribe_organizationId_fkey') THEN
    ALTER TABLE "MarketingUnsubscribe" ADD CONSTRAINT "MarketingUnsubscribe_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PushSubscription_userId_fkey') THEN
    ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'OrganizationMember_organizationId_fkey') THEN
    ALTER TABLE "OrganizationMember" ADD CONSTRAINT "OrganizationMember_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'OrganizationMember_userId_fkey') THEN
    ALTER TABLE "OrganizationMember" ADD CONSTRAINT "OrganizationMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'OrganizationModuleState_organizationId_fkey') THEN
    ALTER TABLE "OrganizationModuleState" ADD CONSTRAINT "OrganizationModuleState_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Appointment_organizationId_fkey') THEN
    ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Appointment_staffId_fkey') THEN
    ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Appointment_customerId_fkey') THEN
    ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Appointment_resourceRecordId_fkey') THEN
    ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_resourceRecordId_fkey" FOREIGN KEY ("resourceRecordId") REFERENCES "ExtensionRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AppointmentService_appointmentId_fkey') THEN
    ALTER TABLE "AppointmentService" ADD CONSTRAINT "AppointmentService_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AppointmentService_serviceId_fkey') THEN
    ALTER TABLE "AppointmentService" ADD CONSTRAINT "AppointmentService_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Product_organizationId_fkey') THEN
    ALTER TABLE "Product" ADD CONSTRAINT "Product_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Product_categoryId_fkey') THEN
    ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Order_organizationId_fkey') THEN
    ALTER TABLE "Order" ADD CONSTRAINT "Order_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Order_customerId_fkey') THEN
    ALTER TABLE "Order" ADD CONSTRAINT "Order_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'OrderItem_orderId_fkey') THEN
    ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'OrderItem_productId_fkey') THEN
    ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FormDefinition_organizationId_fkey') THEN
    ALTER TABLE "FormDefinition" ADD CONSTRAINT "FormDefinition_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FormSubmission_organizationId_fkey') THEN
    ALTER TABLE "FormSubmission" ADD CONSTRAINT "FormSubmission_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FormSubmission_formDefinitionId_fkey') THEN
    ALTER TABLE "FormSubmission" ADD CONSTRAINT "FormSubmission_formDefinitionId_fkey" FOREIGN KEY ("formDefinitionId") REFERENCES "FormDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FormSubmission_customerId_fkey') THEN
    ALTER TABLE "FormSubmission" ADD CONSTRAINT "FormSubmission_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'WorkflowDefinition_organizationId_fkey') THEN
    ALTER TABLE "WorkflowDefinition" ADD CONSTRAINT "WorkflowDefinition_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'WorkflowStage_definitionId_fkey') THEN
    ALTER TABLE "WorkflowStage" ADD CONSTRAINT "WorkflowStage_definitionId_fkey" FOREIGN KEY ("definitionId") REFERENCES "WorkflowDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'WorkOrder_organizationId_fkey') THEN
    ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'WorkOrder_customerId_fkey') THEN
    ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'WorkOrder_workflowDefinitionId_fkey') THEN
    ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_workflowDefinitionId_fkey" FOREIGN KEY ("workflowDefinitionId") REFERENCES "WorkflowDefinition"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'WorkOrder_linkedRecordId_fkey') THEN
    ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_linkedRecordId_fkey" FOREIGN KEY ("linkedRecordId") REFERENCES "ExtensionRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'WorkOrderEvent_workOrderId_fkey') THEN
    ALTER TABLE "WorkOrderEvent" ADD CONSTRAINT "WorkOrderEvent_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ExtensionRecord_organizationId_fkey') THEN
    ALTER TABLE "ExtensionRecord" ADD CONSTRAINT "ExtensionRecord_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ExtensionRecord_customerId_fkey') THEN
    ALTER TABLE "ExtensionRecord" ADD CONSTRAINT "ExtensionRecord_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProductVariant_organizationId_fkey') THEN
    ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProductVariant_productId_fkey') THEN
    ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Package_organizationId_fkey') THEN
    ALTER TABLE "Package" ADD CONSTRAINT "Package_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PrepaidPurchase_organizationId_fkey') THEN
    ALTER TABLE "PrepaidPurchase" ADD CONSTRAINT "PrepaidPurchase_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PrepaidPurchase_prepaidProductId_fkey') THEN
    ALTER TABLE "PrepaidPurchase" ADD CONSTRAINT "PrepaidPurchase_prepaidProductId_fkey" FOREIGN KEY ("prepaidProductId") REFERENCES "Package"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PrepaidPurchase_customerId_fkey') THEN
    ALTER TABLE "PrepaidPurchase" ADD CONSTRAINT "PrepaidPurchase_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PrepaidRedemption_prepaidPurchaseId_fkey') THEN
    ALTER TABLE "PrepaidRedemption" ADD CONSTRAINT "PrepaidRedemption_prepaidPurchaseId_fkey" FOREIGN KEY ("prepaidPurchaseId") REFERENCES "PrepaidPurchase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PrepaidRedemption_appointmentId_fkey') THEN
    ALTER TABLE "PrepaidRedemption" ADD CONSTRAINT "PrepaidRedemption_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PrepaidRedemption_orderId_fkey') THEN
    ALTER TABLE "PrepaidRedemption" ADD CONSTRAINT "PrepaidRedemption_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PackageItem_packageId_fkey') THEN
    ALTER TABLE "PackageItem" ADD CONSTRAINT "PackageItem_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "Package"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PackageItem_serviceId_fkey') THEN
    ALTER TABLE "PackageItem" ADD CONSTRAINT "PackageItem_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PackageItem_productId_fkey') THEN
    ALTER TABLE "PackageItem" ADD CONSTRAINT "PackageItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Document_organizationId_fkey') THEN
    ALTER TABLE "Document" ADD CONSTRAINT "Document_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Document_customerId_fkey') THEN
    ALTER TABLE "Document" ADD CONSTRAINT "Document_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Document_workOrderId_fkey') THEN
    ALTER TABLE "Document" ADD CONSTRAINT "Document_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DocumentItem_documentId_fkey') THEN
    ALTER TABLE "DocumentItem" ADD CONSTRAINT "DocumentItem_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CustomDomain_organizationId_fkey') THEN
    ALTER TABLE "CustomDomain" ADD CONSTRAINT "CustomDomain_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StockMovement_organizationId_fkey') THEN
    ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StockMovement_productId_fkey') THEN
    ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StockMovement_productVariantId_fkey') THEN
    ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_productVariantId_fkey" FOREIGN KEY ("productVariantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StockMovement_orderId_fkey') THEN
    ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StockMovement_supplierRecordId_fkey') THEN
    ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_supplierRecordId_fkey" FOREIGN KEY ("supplierRecordId") REFERENCES "ExtensionRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StockMovement_batchRecordId_fkey') THEN
    ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_batchRecordId_fkey" FOREIGN KEY ("batchRecordId") REFERENCES "ExtensionRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StockMovement_createdById_fkey') THEN
    ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Project_organizationId_fkey') THEN
    ALTER TABLE "Project" ADD CONSTRAINT "Project_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Project_customerId_fkey') THEN
    ALTER TABLE "Project" ADD CONSTRAINT "Project_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Project_workOrderId_fkey') THEN
    ALTER TABLE "Project" ADD CONSTRAINT "Project_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Project_createdById_fkey') THEN
    ALTER TABLE "Project" ADD CONSTRAINT "Project_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProjectTask_organizationId_fkey') THEN
    ALTER TABLE "ProjectTask" ADD CONSTRAINT "ProjectTask_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProjectTask_projectId_fkey') THEN
    ALTER TABLE "ProjectTask" ADD CONSTRAINT "ProjectTask_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ConfigChangeLog_organizationId_fkey') THEN
    ALTER TABLE "ConfigChangeLog" ADD CONSTRAINT "ConfigChangeLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
