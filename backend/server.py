import pandas as pd
import random
import math
import os
from fastapi import FastAPI, File, UploadFile
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
import shutil

app = FastAPI()

# Allow frontend to communicate with backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Only allow your frontend
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_FOLDER = "uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

def add_remarks_to_file(file_path):
    if file_path.endswith(".xlsx"):
        df = pd.read_excel(file_path)
    elif file_path.endswith(".csv"):
        df = pd.read_csv(file_path)
    else:
        return "Unsupported file format"

    row_count = len(df)
    if row_count < 100:
        return "File must have at least 100 rows"

    # Generate remarks
    informed_count = math.ceil(row_count * 0.70)
    off_count = math.ceil(row_count * 0.25)
    no_pick_response_count = math.ceil(row_count * 0.045)
    no_bene_count = max(1, math.ceil(row_count * 0.005))

    remarks_distribution = (
        ["informed"] * informed_count +
        ["off"] * off_count +
        [random.choice(["no pick", "no response"]) for _ in range(no_pick_response_count)] +
        ["no bene"] * no_bene_count
    )

    random.shuffle(remarks_distribution)
    df["REMARKS"] = remarks_distribution[:row_count]

    new_file_path = file_path.replace(".xlsx", "_modified.xlsx").replace(".csv", "_modified.csv")
    if file_path.endswith(".xlsx"):
        df.to_excel(new_file_path, index=False)
    else:
        df.to_csv(new_file_path, index=False)

    return new_file_path

@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    file_path = os.path.join(UPLOAD_FOLDER, file.filename)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    new_file = add_remarks_to_file(file_path)
    if "Unsupported" in new_file or "File must" in new_file:
        return {"message": new_file}
    
    return {"message": "File processed successfully!", "download_url": f"/download/{os.path.basename(new_file)}"}

@app.get("/download/{filename}")
async def download_file(filename: str):
    file_path = os.path.join(UPLOAD_FOLDER, filename)
    return FileResponse(file_path, filename=filename)

# Run the server
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5000)
