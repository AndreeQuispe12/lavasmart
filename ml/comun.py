"""Conexión con Supabase para el proceso de analítica.

Habla con la API REST de Supabase (PostgREST) usando la clave secreta, que
ignora RLS: el proceso necesita escribir en las tablas de salida, que ningún
rol de la aplicación puede modificar. La clave vive en ml/.env, que no se
versiona.
"""

from __future__ import annotations

import os
import sys
from datetime import date, datetime
from pathlib import Path
from zoneinfo import ZoneInfo

import requests
from dotenv import load_dotenv

LIMA = ZoneInfo("America/Lima")

load_dotenv(Path(__file__).with_name(".env"))

# La consola de Windows no usa UTF-8 por defecto y las tildes salen mal.
sys.stdout.reconfigure(encoding="utf-8")


def hoy_en_lima() -> date:
    """El día del negocio: se cuenta en hora de Lima, no en UTC."""
    return datetime.now(LIMA).date()


class Supabase:
    def __init__(self) -> None:
        url = os.environ.get("SUPABASE_URL", "").rstrip("/")
        clave = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
        if not url or not clave:
            raise SystemExit(
                "Falta SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en ml/.env "
                "(copiar ml/.env.example)."
            )
        self.rest = f"{url}/rest/v1"
        self.sesion = requests.Session()
        self.sesion.headers.update(
            {"apikey": clave, "Authorization": f"Bearer {clave}"}
        )

    def leer(self, recurso: str, **filtros: str) -> list[dict]:
        """Lee todas las filas de una tabla o vista, página por página.

        PostgREST devuelve como máximo 1000 filas por pedido, así que se
        pide por rangos hasta que una página llega incompleta.
        """
        filas: list[dict] = []
        tamano = 1000
        while True:
            respuesta = self.sesion.get(
                f"{self.rest}/{recurso}",
                params=filtros,
                headers={"Range": f"{len(filas)}-{len(filas) + tamano - 1}"},
                timeout=60,
            )
            respuesta.raise_for_status()
            pagina = respuesta.json()
            filas.extend(pagina)
            if len(pagina) < tamano:
                return filas

    def guardar(self, tabla: str, filas: list[dict], conflicto: str) -> None:
        """Inserta o actualiza (upsert) según la restricción única dada.

        Volver a correr el proceso el mismo día reemplaza sus resultados en
        lugar de fallar por duplicado.
        """
        if not filas:
            return
        respuesta = self.sesion.post(
            f"{self.rest}/{tabla}",
            params={"on_conflict": conflicto},
            json=filas,
            headers={"Prefer": "resolution=merge-duplicates,return=minimal"},
            timeout=60,
        )
        if not respuesta.ok:
            raise SystemExit(f"No se pudo guardar en {tabla}: {respuesta.text}")
