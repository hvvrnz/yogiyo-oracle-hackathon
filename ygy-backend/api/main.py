from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api.routers import rider, customer, merchant, store, explanation, package, demo

app = FastAPI(title="실속배달 API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(rider.router)
app.include_router(customer.router)
app.include_router(merchant.router)
app.include_router(store.router)
app.include_router(explanation.router)
app.include_router(package.router)
app.include_router(demo.router)


@app.get("/")
def root():
    return {"message": "실속배달 배차 시퀀싱 API"}