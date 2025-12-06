
-- ========================
-- LEAD GROUPS
-- ========================
CREATE TABLE lead_groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    name TEXT NOT NULL,
    is_order BOOLEAN DEFAULT FALSE,
    status TEXT CHECK (status IN ('pending','processing','completed','cancelled')) DEFAULT 'pending',
    order_note TEXT,
    lead_count INTEGER DEFAULT 0,
    ordered_at TIMESTAMP,
    completed_at TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ========================
-- LEADS
-- ========================
CREATE TABLE leads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    name TEXT NOT NULL,
    company TEXT,
    address TEXT,
    city TEXT,
    district TEXT,
    plus_code TEXT,
    phone TEXT,
    website TEXT,
    lat TEXT,
    lng TEXT,
    rating NUMERIC(3,2),
    review_count INT,
    business_type TEXT,
    google_maps_url TEXT,
    search_term TEXT,
    profile_image_url TEXT,
    working_hours JSONB,
    is_favorite BOOLEAN NOT NULL DEFAULT FALSE,
    is_enriched BOOLEAN DEFAULT FALSE,
    enriched_at TIMESTAMP,
    enrichment_status TEXT,
    enrichment_error TEXT,
    primary_group_id UUID REFERENCES lead_groups(id),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_leads_user_id ON leads(user_id);
CREATE INDEX idx_leads_primary_group ON leads(primary_group_id);
CREATE INDEX idx_leads_city_district ON leads(city, district);


CREATE TABLE lead_phones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
    phone TEXT NOT NULL,
    has_whatsapp BOOLEAN DEFAULT FALSE,
    source TEXT, -- örn: 'website', 'map', 'manual'
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE (lead_id, phone)
);

CREATE INDEX idx_lead_phones_lead_id ON lead_phones (lead_id);
CREATE INDEX idx_lead_phones_phone ON lead_phones (phone);


CREATE TABLE lead_emails (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    source TEXT, -- 'website', 'contact_page', 'header', 'footer', vs.
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE (lead_id, email)
);

CREATE INDEX idx_lead_emails_lead_id ON lead_emails (lead_id);
CREATE INDEX idx_lead_emails_email ON lead_emails (email);


