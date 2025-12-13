import requests
import blake3
import uuid

def generate_id():
    return str(uuid.uuid4())

def hash_data(data: str) -> bytes:
    return blake3.blake3(data.encode()).digest()

def make_request(url: str) -> dict:
    response = requests.get(url)
    return response.json()