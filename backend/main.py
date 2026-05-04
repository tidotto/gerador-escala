from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import mysql.connector
import os
from datetime import date
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="Home Office API")

# Configuração de CORS para permitir acesso do GitHub Pages
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Em produção, substitua pelo seu domínio do GitHub Pages
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Conexão com o Banco de Dados
def get_db_connection():
    try:
        conn = mysql.connector.connect(
            host=os.getenv("DB_HOST", "localhost"),
            user=os.getenv("DB_USER"),
            password=os.getenv("DB_PASSWORD"),
            database=os.getenv("DB_NAME")
        )
        return conn
    except mysql.connector.Error as err:
        print(f"Erro: {err}")
        return None

# Modelos de Dados
class Member(BaseModel):
    id: int
    nome: str
    equipe_id: int

class ScaleEntry(BaseModel):
    data: date
    membro_id: int
    equipe_id: int

# Endpoints
@app.get("/")
def read_root():
    return {"status": "Online", "message": "API de Escala Home Office - Bem-vindo!"}

@app.get("/equipes")
def get_teams():
    conn = get_db_connection()
    if not conn: return {"error": "DB connection failed"}
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT * FROM equipes")
    teams = cursor.fetchall()
    conn.close()
    return teams

@app.get("/membros/{equipe_id}")
def get_members(equipe_id: int):
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT * FROM membros WHERE equipe_id = %s AND ativo = 1", (equipe_id,))
    members = cursor.fetchall()
    
    # Busca ausências/férias
    for m in members:
        cursor.execute("SELECT data_inicio, data_fim FROM membros_ausencias WHERE membro_id = %s", (m['id'],))
        m['ausencias'] = cursor.fetchall()
        
    conn.close()
    return members

@app.post("/salvar-escala")
def save_scale(entries: List[ScaleEntry]):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        for entry in entries:
            cursor.execute(
                "INSERT INTO escalas (data, equipe_id, membro_id) VALUES (%s, %s, %s)",
                (entry.data, entry.equipe_id, entry.membro_id)
            )
        conn.commit()
        return {"status": "sucesso", "count": len(entries)}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

@app.get("/ultimo-estado/{equipe_id}")
def get_last_state(equipe_id: int):
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    # Busca o último offset salvo ou a última pessoa escalada
    cursor.execute("SELECT ultimo_offset FROM configuracoes WHERE equipe_id = %s", (equipe_id,))
    config = cursor.fetchone()
    conn.close()
    return config or {"ultimo_offset": 0}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
