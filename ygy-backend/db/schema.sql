-- 브랜드
CREATE TABLE brands (
    brand_id      NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    brand_name    VARCHAR2(100) NOT NULL
);

-- 매장
CREATE TABLE stores (
    store_id           NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    brand_id           NUMBER REFERENCES brands(brand_id),
    name               VARCHAR2(100) NOT NULL,
    category           VARCHAR2(50) NOT NULL,
    address            VARCHAR2(200),
    lat                NUMBER(9,6) NOT NULL,
    lng                NUMBER(9,6) NOT NULL,
    base_cooking_min   NUMBER NOT NULL,
    current_order_count NUMBER DEFAULT 0,
    congestion         VARCHAR2(10) DEFAULT 'LOW' CHECK (congestion IN ('LOW','MEDIUM','HIGH')),
    prediction_accuracy_pct NUMBER DEFAULT 80
);

-- correction_factor (5단계 fallback)
CREATE TABLE correction_factors (
    factor_id      NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    scope_type     VARCHAR2(10) NOT NULL CHECK (scope_type IN ('store','brand','category','global')),
    scope_id       NUMBER,
    scope_value    VARCHAR2(50),
    factor_value   NUMBER DEFAULT 1.0 NOT NULL,
    sample_count   NUMBER DEFAULT 0,
    updated_at     TIMESTAMP DEFAULT SYSTIMESTAMP
);

-- 고객
CREATE TABLE customers (
    customer_id    NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    delivery_lat   NUMBER(9,6),
    delivery_lng   NUMBER(9,6),
    delivery_address VARCHAR2(200)
);

-- 라이더
CREATE TABLE riders (
    rider_id       NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    display_name   VARCHAR2(50),
    vehicle        VARCHAR2(20) DEFAULT '오토바이',
    status         VARCHAR2(20) DEFAULT 'AVAILABLE',
    current_lat    NUMBER(9,6),
    current_lng    NUMBER(9,6),
    location_updated_at TIMESTAMP DEFAULT SYSTIMESTAMP,
    completed_order_count NUMBER DEFAULT 0
);

-- 패키지 (묶음)
CREATE TABLE packages (
    package_id       NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    rider_id         VARCHAR2(50),
    status           VARCHAR2(20) DEFAULT 'MATCHING',
    bundle_size      NUMBER,
    score            NUMBER,
    package_revenue  NUMBER,
    hourly_revenue   NUMBER,
    order_ids        JSON,
    route_detail     JSON,
    score_detail     JSON,
    created_at       TIMESTAMP DEFAULT SYSTIMESTAMP,
    offered_at       TIMESTAMP,
    accepted_at      TIMESTAMP,
    completed_at     TIMESTAMP
);

-- 주문
CREATE TABLE orders (
    order_id            NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    customer_id         NUMBER REFERENCES customers(customer_id),
    store_id            NUMBER REFERENCES stores(store_id),
    package_id          NUMBER REFERENCES packages(package_id),
    menu_summary         VARCHAR2(200),
    amount               NUMBER,
    delivery_fee          NUMBER,
    request_note           VARCHAR2(200),
    status                 VARCHAR2(20) DEFAULT 'NEW',
    created_at              TIMESTAMP DEFAULT SYSTIMESTAMP,
    predicted_ready_at       TIMESTAMP,
    vector_corrected_at       TIMESTAMP,
    actual_ready_at            TIMESTAMP,
    picked_up_at                 TIMESTAMP,
    delivered_at                   TIMESTAMP
);

-- 경로 단계
CREATE TABLE route_steps (
    step_id        NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    package_id     NUMBER REFERENCES packages(package_id),
    sequence       NUMBER,
    type           VARCHAR2(10) CHECK (type IN ('PICKUP','DELIVERY')),
    order_id       NUMBER REFERENCES orders(order_id),
    lat            NUMBER(9,6),
    lng            NUMBER(9,6),
    display_name   VARCHAR2(100),
    distance_km    NUMBER,
    duration_min   NUMBER,
    eta_at         TIMESTAMP,
    status         VARCHAR2(20) DEFAULT 'PENDING'
);

-- 패키지 스코어
CREATE TABLE package_scores (
    package_id             NUMBER PRIMARY KEY REFERENCES packages(package_id),
    food_sitting_time      NUMBER,
    courier_wait_time      NUMBER,
    bag_time               NUMBER,
    total_time             NUMBER,
    score                  NUMBER,
    package_revenue        NUMBER,
    hourly_revenue          NUMBER
);

-- 과거 케이스 임베딩 (Vector Search)
CREATE TABLE vector_cases (
    case_id                 NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    store_id                NUMBER REFERENCES stores(store_id),
    weekday                 NUMBER,
    time_slot                VARCHAR2(20),
    concurrent_order_count   NUMBER,
    actual_cook_time          NUMBER,
    embedding                  VECTOR(1024, FLOAT32)
);

-- 설명 (LLM 생성)
CREATE TABLE explanations (
    explanation_id  NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    package_id      NUMBER REFERENCES packages(package_id),
    consumer_text   CLOB,
    rider_text      CLOB,
    created_at      TIMESTAMP DEFAULT SYSTIMESTAMP
);