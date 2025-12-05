-- ========================
-- EXTENSION FOR UUID
-- ========================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ========================
-- USERS
-- ========================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    auth_id TEXT UNIQUE NOT NULL,
    name TEXT,
    email TEXT UNIQUE,
    phone TEXT,
    company_name TEXT,
    industry TEXT,
    role TEXT,
    whatsapp_limit INT DEFAULT 100,
    mail_limit INT DEFAULT 100,
    visit_limit INT DEFAULT 10,
    call_limit INT DEFAULT 30,
    monthly_credit_limit INT DEFAULT 0,
    monthly_credits_used INT DEFAULT 0,
    subscription_start TIMESTAMP,
    subscription_end TIMESTAMP,
    plan_id UUID REFERENCES plans(id),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ========================
-- PLANS
-- ========================
CREATE TABLE plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    monthly_credits INT NOT NULL,
    price NUMERIC(10,2) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ========================
-- CREDIT_PACKAGES
-- ========================
CREATE TABLE credit_packages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    credits INT NOT NULL,
    price NUMERIC(10,2) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ========================
-- PAYMENTS
-- ========================
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    package_id UUID REFERENCES plans(id),
    amount NUMERIC(10,2),
    currency TEXT DEFAULT 'TRY',
    status TEXT CHECK (status IN ('pending','completed','failed')) DEFAULT 'pending',
    note TEXT,
    payment_date TIMESTAMP DEFAULT NOW(),
    payment_provider TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ========================
-- USER CREDIT TRANSACTIONS
-- ========================
CREATE TABLE user_credit_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    type TEXT CHECK (type IN ('add','use')) NOT NULL,
    credits INT NOT NULL,
    amount NUMERIC(10,2),
    note TEXT,
    source TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_user_credit_user_id ON user_credit_transactions(user_id);

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

-- ========================
-- LEAD GROUPS MAP
-- ========================
CREATE TABLE lead_groups_map (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    lead_id UUID REFERENCES leads(id),
    lead_group_id UUID REFERENCES lead_groups(id),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_lgm_user_id ON lead_groups_map(user_id);
CREATE INDEX idx_lgm_lead_group_id ON lead_groups_map(lead_group_id);
CREATE INDEX idx_lgm_lead_id ON lead_groups_map(lead_id);

-- ========================
-- LEAD TAGS
-- ========================
CREATE TABLE lead_tags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    name TEXT NOT NULL,
    color TEXT DEFAULT '#3B82F6',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ========================
-- LEAD TAG MAP
-- ========================
CREATE TABLE lead_tag_map (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    lead_id UUID REFERENCES leads(id),
    tag_id UUID REFERENCES lead_tags(id),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_ltm_user_id ON lead_tag_map(user_id);
CREATE INDEX idx_ltm_lead_id ON lead_tag_map(lead_id);
CREATE INDEX idx_ltm_tag_id ON lead_tag_map(tag_id);

-- ========================
-- CAMPAIGNS
-- ========================
CREATE TABLE campaigns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    name TEXT NOT NULL,
    title TEXT,
    content TEXT,
    campaign_type TEXT CHECK (campaign_type IN ('whatsapp','mail','call','visit')) NOT NULL,
    start_date TIMESTAMP,
    end_date TIMESTAMP,
    total_leads INTEGER DEFAULT 0,
    status TEXT CHECK (status IN ('draft','active','completed','cancelled')) DEFAULT 'draft',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_campaigns_user_id ON campaigns(user_id);

-- ========================
-- CAMPAIGN GROUPS
-- ========================
CREATE TABLE campaign_groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    campaign_id UUID REFERENCES campaigns(id),
    lead_group_id UUID REFERENCES lead_groups(id),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_cg_user_id ON campaign_groups(user_id);
CREATE INDEX idx_cg_campaign_id ON campaign_groups(campaign_id);
CREATE INDEX idx_cg_lead_group_id ON campaign_groups(lead_group_id);

-- ========================
-- CAMPAIGN LEADS
-- ========================
CREATE TABLE campaign_leads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    campaign_id UUID REFERENCES campaigns(id),
    lead_id UUID REFERENCES leads(id),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_cl_user_id ON campaign_leads(user_id);
CREATE INDEX idx_cl_campaign_id ON campaign_leads(campaign_id);
CREATE INDEX idx_cl_lead_id ON campaign_leads(lead_id);

-- ========================
-- ACTIVITIES
-- ========================
CREATE TABLE activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    lead_id UUID REFERENCES leads(id),
    activity_type TEXT CHECK (activity_type IN ('note','email','call','whatsapp','follow_up','visit','meeting','todo')) NOT NULL,
    content TEXT,
    status TEXT CHECK (status IN ('pending','completed','cancelled')) DEFAULT 'pending',
    due_date TIMESTAMP,
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP NULL,
    campaign_id UUID REFERENCES campaigns(id),
    activity_reference_id UUID REFERENCES activities(id),
    created_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP
);

CREATE INDEX idx_activities_user_id ON activities(user_id);
CREATE INDEX idx_activities_lead_id ON activities(lead_id);
CREATE INDEX idx_activities_campaign_id ON activities(campaign_id);


-- ========================
-- NOTIFICATIONS
-- ========================
--type: info , warning , error , success
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    type TEXT,
    message TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);



CREATE TABLE lead_phones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
    phone TEXT NOT NULL,
    has_whatsapp BOOLEAN DEFAULT FALSE,
    source TEXT, -- örn: 'website', 'map', 'manual'
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_lead_phones_lead_id ON lead_phones (lead_id);
CREATE INDEX idx_lead_phones_phone ON lead_phones (phone);


CREATE TABLE lead_emails (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    source TEXT, -- 'website', 'contact_page', 'header', 'footer', vs.
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_lead_emails_lead_id ON lead_emails (lead_id);
CREATE INDEX idx_lead_emails_email ON lead_emails (email);





/*
plans tablosu olmalıdır. 

credit_packages

user_credit_transactions 

payments → Kullanıcının satın aldığı paket veya ek kredi ödemelerini, tutar, tarih ve ödeme durumu ile birlikte kaydeder.

campaigns → Kampanya ana bilgileri (isim, tür, tarih, durum, oluşturucu).

campaign_groups → Kampanyaya bağlı lead grupları.

campaign_leads → Kampanyaya tek tek eklenen leadler (individual).

leads → Tüm lead bilgileri (isim, firma, adres, iletişim, primary_group_id ile ana gurubu tutulur

lead_groups → Leadleri gruplamak için (örn. İstanbul Kuaför Listesi).

lead_groups_map → Kullanıcının oluşturduğu Lead–LeadGroup ilişki tablosu (many-to-many).

users → Sistemdeki kullanıcı bilgileri - supa auth ile ilişkili, hesap bilgilerini tutar

user_credit_transactions → Kampanyalarda veya ek kredilerde kullanılan/eklenen krediler (opsiyonel, paketle ilişkili).

activities (kampanya + CRM aktiviteleri) → Lead ile yapılan tüm etkileşimleri ve aktiviteleri (note, email, call, visit, meeting, task) tek bir tabloda kronolojik olarak tutar; kampanya kaynaklı aktiviteler campaign_id ile ayırt edilir ve böylece her lead için zaman çizelgesi ve geçmiş aksiyonlar yönetilebilir.

tasks -> Sadece “tamamlanması gereken görevleri” (task, follow-up, ziyaret, arama hatırlatma vb.) hızlı listelemek için optimize edilmiş, activity kayıtlarının görev niteliğindeki alt kümesini tutan performans odaklı tablodur.

lead_tags → Kullanıcının oluşturduğu etiketleri (örn: “VIP”, “Hot Lead”, “Tekrar Aranacak”) saklayan tablo.

lead_tag_map → Lead ile etiketlerin ilişkisini tutan many-to-many bağlantı tablosu.

notifications → Kullanıcıya sistem mesajı veya uyarı göndermek için (veri hazır, kredi yetersiz, ödeme hatası).
 */