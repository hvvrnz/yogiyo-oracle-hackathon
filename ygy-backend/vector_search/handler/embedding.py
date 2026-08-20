import oci

config = oci.config.from_file()

generative_ai_client = oci.generative_ai_inference.GenerativeAiInferenceClient(
    config=config,
    service_endpoint="https://inference.generativeai.us-chicago-1.oci.oraclecloud.com",
)

COMPARTMENT_ID = "ocid1.compartment.oc1..aaaaaaaalrs7svywbzhe4uizalih4nmy7a2v4myrrd7mxwljutbc5tmrkp5a"
WEEKDAY_KO = ['월요일', '화요일', '수요일', '목요일', '금요일', '토요일', '일요일']


def embed_situation(store_id, weekday, time_slot, concurrent_order_count, menu_name=None):
    """
    현재 상황을 텍스트로 만들어서 OCI Generative AI(Cohere Embed)로 벡터화.
    """
    weekday_label = WEEKDAY_KO[weekday] if isinstance(weekday, int) else weekday  # ← 이 줄 추가
    text = f"매장ID {store_id}, {weekday_label}, 시간대 {time_slot}, 동시주문 {concurrent_order_count}건"  # ← 기존 줄 수정
    if menu_name:
        text += f", 메뉴 {menu_name}"

    embed_text_detail = oci.generative_ai_inference.models.EmbedTextDetails(
        inputs=[text],
        serving_mode=oci.generative_ai_inference.models.OnDemandServingMode(
            model_id="cohere.embed-multilingual-v3.0"
        ),
        compartment_id=COMPARTMENT_ID,
    )

    response = generative_ai_client.embed_text(embed_text_detail)
    return response.data.embeddings[0]