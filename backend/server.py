import pandas as pd
import random
import math
import os
import tempfile
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
import shutil

app = FastAPI()

# Allow frontend to communicate with backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ALLOWED_EXTENSIONS = {".csv", ".xlsx"}

def add_remarks_to_file(file_path):
    """Adds remarks to the uploaded file and saves the modified version."""
    if file_path.endswith(".xlsx"):
        df = pd.read_excel(file_path)
    elif file_path.endswith(".csv"):
        df = pd.read_csv(file_path)
    else:
        return "Unsupported file format"

    row_count = len(df)
    if row_count < 1:
        return "File must have at least 1 rows"

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

    # Save modified file in the temp directory
    new_file_path = file_path.replace(".xlsx", "_modified.xlsx").replace(".csv", "_modified.csv")
    if file_path.endswith(".xlsx"):
        df.to_excel(new_file_path, index=False)
    else:
        df.to_csv(new_file_path, index=False)

    return new_file_path

@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    """Handles file upload, processing, and provides a download link."""
    filename = os.path.basename(file.filename)  # Sanitize filename

    if not any(filename.endswith(ext) for ext in ALLOWED_EXTENSIONS):
        raise HTTPException(status_code=400, detail="Invalid file type. Only CSV and Excel allowed.")

    with tempfile.NamedTemporaryFile(delete=False, suffix=filename) as temp_file:
        file_path = temp_file.name
        shutil.copyfileobj(file.file, temp_file)

    new_file = add_remarks_to_file(file_path)

    if "Unsupported" in new_file or "File must" in new_file:
        os.remove(file_path)  # Delete temp file if processing fails
        return {"message": new_file}

    return {"message": "File processed successfully!", "download_url": f"/download/{os.path.basename(new_file)}"}

@app.get("/download/{filename}")
async def download_file(filename: str):
    """Allows the user to download the processed file and deletes it afterward."""
    temp_dir = tempfile.gettempdir()
    file_path = os.path.join(temp_dir, filename)

    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")

    response = FileResponse(file_path, filename=filename)

    # Delete file after download
    try:
        os.remove(file_path)
    except Exception as e:
        print(f"Error deleting file {file_path}: {e}")

    return response

# Run the server
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5000)
