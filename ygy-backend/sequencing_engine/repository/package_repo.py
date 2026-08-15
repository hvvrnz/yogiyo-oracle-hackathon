import json
from db.connection import get_connection
from common.rounding import round_to_unit


def insert_package(
    rider_id,
    package_type,
    order_ids,
    route_detail,
    score,
    score_detail,
    package_revenue,
    hourly_revenue,
    status="MATCHING",
):
    conn = get_connection()
    cursor = conn.cursor()

    package_id_var = cursor.var(int)

    cursor.execute("""
        INSERT INTO packages (
            rider_id,
            package_type,
            status,
            bundle_size,
            score,
            package_revenue,
            hourly_revenue,
            order_ids,
            route_detail,
            score_detail,
            offered_at
        ) VALUES (
            :rider_id,
            :package_type,
            :status,
            :bundle_size,
            :score,
            :package_revenue,
            :hourly_revenue,
            :order_ids,
            :route_detail,
            :score_detail,
            CASE
                WHEN :status = 'OFFERED' THEN SYSTIMESTAMP
                ELSE NULL
            END
        )
        RETURNING package_id INTO :package_id
    """, {
        "rider_id": rider_id,
        "package_type": package_type,
        "status": status,
        "bundle_size": len(order_ids),
        "score": round(score),
        "package_revenue": round_to_unit(package_revenue, 100),
        "hourly_revenue": round_to_unit(hourly_revenue, 100),
        "order_ids": json.dumps(order_ids),
        "route_detail": json.dumps(route_detail),
        "score_detail": json.dumps(score_detail),
        "package_id": package_id_var,
    })

    conn.commit()

    package_id = package_id_var.getvalue()[0]

    cursor.close()
    conn.close()

    return package_id