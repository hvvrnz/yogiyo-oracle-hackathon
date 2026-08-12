from fastapi import FastAPI
from api.routers import rider, customer, merchant, store

app = FastAPI(title="실속배달 API")

app.include_router(rider.router)
app.include_router(customer.router)
app.include_router(merchant.router)
app.include_router(store.router)


@app.get("/")
def root():
    return {"message": "실속배달 배차 시퀀싱 API"}