import os
from typing import List
from langchain_core.documents import Document
from .base_handler import BaseFileHandler


class CSVHandler(BaseFileHandler):
    supported_extensions = [".csv", ".xlsx", ".xls"]

    def load(self, file_path: str) -> List[Document]:
        print(f"  [CSVHandler] Loading: {file_path}")
        try:
            import pandas as pd
        except ImportError:
            raise RuntimeError("Run: pip install pandas openpyxl")

        ext = os.path.splitext(file_path)[1].lower()
        filename = os.path.basename(file_path)

        # Load based on extension
        if ext == ".csv":
            df = pd.read_csv(file_path, encoding="utf-8", errors="replace")
            sheets = {"Sheet1": df}
        else:
            # Excel — load all sheets
            xl     = pd.ExcelFile(file_path)
            sheets = {name: xl.parse(name) for name in xl.sheet_names}

        documents = []
        page_num  = 1

        for sheet_name, df in sheets.items():
            if df.empty:
                continue

            # Clean dataframe
            df = df.dropna(how="all").fillna("")

            # ── Summary document ──────────────────────────────────────────────
            summary = self._build_summary(df, sheet_name, filename)
            documents.append(Document(
                page_content=summary,
                metadata={
                    "source":     file_path,
                    "file_type":  ext.lstrip("."),
                    "filename":   filename,
                    "sheet":      sheet_name,
                    "page":       page_num,
                    "type":       "summary",
                    "rows":       len(df),
                    "columns":    len(df.columns)
                }
            ))
            page_num += 1

            # ── Row batch documents ───────────────────────────────────────────
            # Convert rows to natural language in batches of 50
            batch_size = 50
            for batch_start in range(0, len(df), batch_size):
                batch = df.iloc[batch_start: batch_start + batch_size]
                batch_text = self._rows_to_text(batch, df.columns.tolist())

                documents.append(Document(
                    page_content=batch_text,
                    metadata={
                        "source":      file_path,
                        "file_type":   ext.lstrip("."),
                        "filename":    filename,
                        "sheet":       sheet_name,
                        "page":        page_num,
                        "type":        "data",
                        "row_start":   batch_start + 1,
                        "row_end":     min(batch_start + batch_size, len(df)),
                    }
                ))
                page_num += 1

        print(f"  [CSVHandler] Loaded {len(documents)} documents from {len(sheets)} sheet(s).")
        return documents

    def _build_summary(self, df, sheet_name: str, filename: str) -> str:
        """Builds a natural language summary of the spreadsheet."""
        cols    = df.columns.tolist()
        summary = [
            f"File: {filename} | Sheet: {sheet_name}",
            f"Total rows: {len(df)} | Columns: {', '.join(str(c) for c in cols)}",
            "",
            "Column Overview:"
        ]
        for col in cols:
            sample = df[col].dropna().head(3).tolist()
            summary.append(f"  - {col}: sample values → {sample}")
        return "\n".join(summary)

    def _rows_to_text(self, df, columns: list) -> str:
        """Converts dataframe rows to readable text."""
        lines = []
        for _, row in df.iterrows():
            parts = [f"{col}: {row[col]}" for col in columns if str(row[col]).strip()]
            if parts:
                lines.append(" | ".join(parts))
        return "\n".join(lines)