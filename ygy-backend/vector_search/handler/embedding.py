import oci

config = oci.config.from_file()  # 그대로 서울 config 사용 (인증은 리전 무관)

generative_ai_client = oci.generative_ai_inference.GenerativeAiInferenceClient(
    config=config,
    service_endpoint="https://inference.generativeai.us-chicago-1.oci.oraclecloud.com",  # ai 서비스 제공 되는 시카고 region으로 고정
)

COMPARTMENT_ID = "ocid1.compartment.oc1..aaaaaaaalrs7svywbzhe4uizalih4nmy7a2v4myrrd7mxwljutbc5tmrkp5a"


def embed_situation(store_id, weekday, time_slot, concurrent_order_count):
    """
    현재 상황을 텍스트로 만들어서 OCI Generative AI(Cohere Embed)로 벡터화.
    """
    text = f"매장ID {store_id}, 요일 {weekday}, 시간대 {time_slot}, 동시주문 {concurrent_order_count}건"

    embed_text_detail = oci.generative_ai_inference.models.EmbedTextDetails(
        inputs=[text],
        serving_mode=oci.generative_ai_inference.models.OnDemandServingMode(
            model_id="cohere.embed-multilingual-v3.0"
        ),
        compartment_id=COMPARTMENT_ID,
    )

    response = generative_ai_client.embed_text(embed_text_detail)
    return response.data.embeddings[0]