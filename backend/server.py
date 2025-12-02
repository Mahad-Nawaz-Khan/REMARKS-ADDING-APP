import pandas as pd
import random
import math
import os
import tempfile
from fastapi import FastAPI, File, HTTPException, UploadFile, BackgroundTasks
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
import shutil
import uuid

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
# Store processed files with unique IDs
PROCESSED_FILES = {}

def add_remarks_to_file(file_path, file_id, original_filename):
    """Adds remarks to the uploaded file and saves the modified version."""
    try:
        if file_path.endswith(".xlsx"):
            df = pd.read_excel(file_path)
        elif file_path.endswith(".csv"):
            df = pd.read_csv(file_path)
        else:
            PROCESSED_FILES[file_id] = {"status": "error", "message": "Unsupported file format"}
            return

        row_count = len(df)
        if row_count < 1:
            PROCESSED_FILES[file_id] = {"status": "error", "message": "File must have at least 1 row"}
            return

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
        # Create a clean filename without temp file suffix
        base_name, ext = os.path.splitext(original_filename)
        clean_filename = f"{base_name}_modified{ext}"
        new_file_path = os.path.join(tempfile.gettempdir(), clean_filename)
        
        if file_path.endswith(".xlsx"):
            df.to_excel(new_file_path, index=False)
        else:
            df.to_csv(new_file_path, index=False)

        # Update status and provide download path
        PROCESSED_FILES[file_id] = {
            "status": "completed", 
            "file_path": new_file_path,
            "filename": clean_filename
        }
    except Exception as e:
        PROCESSED_FILES[file_id] = {"status": "error", "message": f"Error processing file: {str(e)}"}
    finally:
        # Clean up the original temp file
        try:
            if os.path.exists(file_path):
                os.remove(file_path)
        except Exception as e:
            print(f"Error removing temp file: {e}")

@app.post("/upload")
async def upload_file(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    """Handles file upload, processing, and provides a download link."""
    filename = os.path.basename(file.filename)  # Sanitize filename

    if not any(filename.endswith(ext) for ext in ALLOWED_EXTENSIONS):
        raise HTTPException(status_code=400, detail="Invalid file type. Only CSV and Excel allowed.")

    # Generate a unique ID for this file processing task
    file_id = str(uuid.uuid4())
    
    # Store the file
    with tempfile.NamedTemporaryFile(delete=False, suffix=filename) as temp_file:
        file_path = temp_file.name
        shutil.copyfileobj(file.file, temp_file)

    # Process the file in the background
    PROCESSED_FILES[file_id] = {"status": "processing"}
    background_tasks.add_task(add_remarks_to_file, file_path, file_id, filename)

    return {"message": "File uploaded and being processed", "file_id": file_id}

@app.get("/status/{file_id}")
async def check_status(file_id: str):
    """Check the status of a file processing task."""
    if file_id not in PROCESSED_FILES:
        raise HTTPException(status_code=404, detail="File ID not found")
    
    status_info = PROCESSED_FILES[file_id]
    
    if status_info["status"] == "completed":
        return {
            "status": "completed", 
            "message": "File processed successfully!",
            "download_url": f"/download/{file_id}"
        }
    elif status_info["status"] == "error":
        return {"status": "error", "message": status_info["message"]}
    else:
        return {"status": "processing", "message": "File is still being processed"}

@app.get("/download/{file_id}")
async def download_file(file_id: str):
    """Allows the user to download the processed file."""
    if file_id not in PROCESSED_FILES or PROCESSED_FILES[file_id]["status"] != "completed":
        raise HTTPException(status_code=404, detail="File not found or processing not complete")
    
    file_info = PROCESSED_FILES[file_id]
    file_path = file_info["file_path"]
    filename = file_info["filename"]

    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")

    # Return the file as a download
    return FileResponse(
        file_path, 
        filename=filename,
        background=BackgroundTasks().add_task(
            lambda: os.remove(file_path) if os.path.exists(file_path) else None
        )
    )

# Run the server
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5000)
