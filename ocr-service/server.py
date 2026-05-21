#!/usr/bin/env python3
"""
OCR Service — OpenAI-Compatible API using Tesseract
Handles receipts from Walmart, restaurants, fuel stations and more.
"""

import re
import base64
import json
import logging
from io import BytesIO
from datetime import datetime

from flask import Flask, request, jsonify
import pytesseract
from PIL import Image, ImageEnhance, ImageFilter

try:
    import pdf2image
    PDF_SUPPORT = True
except ImportError:
    PDF_SUPPORT = False

app = Flask(__name__)
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("ocr")

# ── Image preprocessing ───────────────────────────────────────────────────────

def preprocess(image: Image.Image) -> Image.Image:
    image = image.convert("L")
    image = ImageEnhance.Contrast(image).enhance(2.0)
    image = ImageEnhance.Sharpness(image).enhance(2.0)
    image = image.filter(ImageFilter.SHARPEN)
    w, h = image.size
    if w < 1200:
        scale = 1200 / w
        image = image.resize((int(w * scale), int(h * scale)), Image.LANCZOS)
    return image

def extract_text(b64: str, content_type: str) -> str:
    raw = base64.b64decode(b64)
    cfg = "--psm 4 --oem 3"
    if "pdf" in content_type and PDF_SUPPORT:
        pages = pdf2image.convert_from_bytes(raw, dpi=300)
        return "\n".join(pytesseract.image_to_string(preprocess(p), config=cfg) for p in pages)
    return pytesseract.image_to_string(preprocess(Image.open(BytesIO(raw))), config=cfg)

# ── Category detection ────────────────────────────────────────────────────────

CATEGORIES = {
    "Groceries":        ["walmart","supermarket","grocery","costco","whole foods",
                         "trader joe","kroger","safeway","aldi","lidl","food mart","food store"],
    "Food & Dining":    ["restaurant","cafe","coffee","pizza","burger","sushi","mcdonald",
                         "starbucks","subway","chipotle","taco","kfc","bistro","diner","bakery"],
    "Transport":        ["uber","lyft","taxi","gas station","fuel","petrol","shell","bp",
                         "exxon","chevron","parking","transit","airline","train","bus"],
    "Shopping":         ["amazon","target","best buy","home depot","lowes","ikea",
                         "store","shop","mall","retail","outlet","clothing"],
    "Healthcare":       ["pharmacy","cvs","walgreens","rite aid","medical","hospital",
                         "clinic","dental","optical","doctor","health"],
    "Utilities":        ["electric","water","gas company","internet","at&t","verizon",
                         "comcast","phone","telecom","utility","energy","power"],
    "Entertainment":    ["cinema","amc","regal","movie","theatre","concert",
                         "netflix","spotify","hulu","disney","streaming","game"],
    "Accommodation":    ["hotel","motel","inn","airbnb","marriott","hilton",
                         "hyatt","holiday inn","hostel","resort","suites"],
    "Software/SaaS":    ["subscription","license","software","app","digital",
                         "google","microsoft","apple","adobe","dropbox","zoom"],
}

def guess_category(text: str) -> str:
    t = text.lower()
    for cat, keywords in CATEGORIES.items():
        if any(k in t for k in keywords):
            return cat
    return "Other"

# ── Amount cleaning ───────────────────────────────────────────────────────────

def clean_amount(raw: str) -> str:
    # Remove currency symbols and spaces
    raw = re.sub(r'[\$£€¥₹\s]', '', raw)
    raw = raw.replace(",", ".")
    parts = raw.split(".")
    if len(parts) > 2:
        raw = parts[0] + "." + parts[-1]
    try:
        return f"{float(raw):.2f}"
    except Exception:
        return raw

# ── Receipt parser ────────────────────────────────────────────────────────────

# Lines to skip when looking for merchant
SKIP_MERCHANT = re.compile(
    r'^(receipt|invoice|bill|order|date|time|tel|phone|fax|address|www|http|'
    r'save money|thank you|welcome|visit|open|closed|hours|store #|st#|op#|'
    r'transaction|approval|account|ref #|trans|terminal|tc #|items sold)',
    re.I
)

# Lines to skip when looking for items
SKIP_ITEMS = re.compile(
    r'^(total|subtotal|sub.?total|tax|vat|gst|hst|pst|'
    r'tend|change|cash|credit|debit|visa|mastercard|amex|'
    r'tip|gratuity|discount|savings|balance|amount due|'
    r'st#|op#|te#|tr#|tc#|account|approval|ref|trans|terminal|'
    r'validation|payment|items sold|low price)',
    re.I
)

def parse_receipt(text: str) -> dict:
    lines = [ln.strip() for ln in text.split("\n") if ln.strip()]
    log.info(f"OCR: {len(lines)} lines, {len(text)} chars")

    result = {
        "name":        "",
        "merchant":    "",
        "date":        "",
        "total":       "",
        "currency":    "USD",
        "tax":         "",
        "description": text[:1000].strip(),
        "category":    "",
        "notes":       "",
        "items":       [],
    }

    # ── Merchant ──────────────────────────────────────────────────────────────
    # Try first 8 lines, pick the first clean meaningful one
    for line in lines[:8]:
        clean = line.strip("*-=. \t")
        if (len(clean) >= 3
                and not re.match(r'^[\d\s\-\/\.\*\#\=]+$', clean)
                and not SKIP_MERCHANT.match(clean)):
            result["merchant"] = clean
            result["name"] = clean
            break

    # ── Currency ──────────────────────────────────────────────────────────────
    if re.search(r'£|GBP', text):      result["currency"] = "GBP"
    elif re.search(r'€|EUR', text):    result["currency"] = "EUR"
    elif re.search(r'¥|JPY', text):    result["currency"] = "JPY"
    elif re.search(r'₹|INR', text):    result["currency"] = "INR"
    elif re.search(r'A\$|AUD', text):  result["currency"] = "AUD"
    elif re.search(r'C\$|CAD', text):  result["currency"] = "CAD"

    # ── Date ──────────────────────────────────────────────────────────────────
    date_pats = [
        r'\b(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4})\b',         # 10/26/2025
        r'\b(\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2})\b',         # 2025-10-26
        r'\b(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2})\b',         # 10/26/25
        r'\b(\w{3,9}\s+\d{1,2},?\s+\d{4})\b',                 # October 26, 2025
        r'\b(\d{1,2}\s+\w{3,9}\s+\d{4})\b',                   # 26 October 2025
    ]
    for pat in date_pats:
        m = re.search(pat, text, re.I)
        if m:
            result["date"] = m.group(1)
            break

    # ── Total ─────────────────────────────────────────────────────────────────
    # Order matters: try specific labels first, fallback to bare TOTAL
    total_pats = [
        r'(?:GRAND\s+TOTAL|TOTAL\s+AMOUNT|AMOUNT\s+DUE|BALANCE\s+DUE|TOTAL\s+DUE)'
        r'\s*[\$£€¥₹]?\s*(\d{1,6}[.,]\d{2})',
        r'^TOTAL\s+[\$£€¥₹]?\s*(\d{1,6}[.,]\d{2})',           # TOTAL $18.83
        r'^TOTAL\s{2,}[\$£€¥₹]?\s*(\d{1,6}[.,]\d{2})',        # TOTAL     $18.83
        r'[\$£€¥₹]\s*(\d{1,6}[.,]\d{2})\s*$',                 # last $XX.XX on line
    ]
    for pat in total_pats:
        m = re.search(pat, text, re.I | re.M)
        if m:
            result["total"] = clean_amount(m.group(1))
            break

    # ── Tax ───────────────────────────────────────────────────────────────────
    tax_m = re.search(
        r'^(?:TAX|GST|VAT|HST|PST|SALES\s+TAX)\s+[\$£€¥₹]?\s*(\d{1,6}[.,]\d{2})',
        text, re.I | re.M
    )
    if tax_m:
        result["tax"] = clean_amount(tax_m.group(1))

    # ── Category ──────────────────────────────────────────────────────────────
    result["category"] = guess_category(text)

    # ── Line items ────────────────────────────────────────────────────────────
    # Patterns for: "ITEM NAME    $3.84"  or  "ITEM NAME    3.84"
    item_pats = [
        re.compile(r'^(.+?)\s{2,}[\$£€¥₹]\s*(\d{1,5}[.,]\d{2})\s*$'),   # name  $X.XX
        re.compile(r'^(.+?)\s{3,}(\d{1,5}[.,]\d{2})\s*$'),                # name    X.XX
    ]
    for line in lines:
        matched = False
        for pat in item_pats:
            m = pat.match(line)
            if m:
                item_name = m.group(1).strip().strip("*-= \t")
                item_price = clean_amount(m.group(2))
                if (len(item_name) >= 2
                        and len(item_name) <= 60
                        and not SKIP_ITEMS.match(item_name)):
                    result["items"].append({"name": item_name, "total": item_price})
                    matched = True
                    break

    log.info(
        f"Result → merchant='{result['merchant']}' date='{result['date']}' "
        f"total='{result['total']}' tax='{result['tax']}' "
        f"items={len(result['items'])} category='{result['category']}'"
    )
    return result

# ── API endpoints ─────────────────────────────────────────────────────────────

@app.route("/v1/chat/completions", methods=["POST"])
def chat_completions():
    data  = request.get_json(force=True, silent=True) or {}
    ocr_text = ""

    for msg in data.get("messages", []):
        content = msg.get("content", [])
        if not isinstance(content, list):
            continue
        for item in content:
            if item.get("type") == "image_url":
                url = item["image_url"].get("url", "")
                if url.startswith("data:"):
                    try:
                        meta, b64 = url.split(";base64,", 1)
                        ocr_text = extract_text(b64, meta.replace("data:", ""))
                    except Exception as e:
                        log.error(f"OCR failed: {e}")

    parsed = parse_receipt(ocr_text) if ocr_text else {
        "name":"","merchant":"","date":"","total":"","currency":"USD",
        "tax":"","description":"","category":"","notes":"","items":[]
    }

    return jsonify({
        "id":      f"ocr-{int(datetime.now().timestamp())}",
        "object":  "chat.completion",
        "created": int(datetime.now().timestamp()),
        "model":   "tesseract-ocr",
        "choices": [{
            "index": 0,
            "message": {
                "role":    "assistant",
                "content": json.dumps(parsed)
            },
            "finish_reason": "stop"
        }],
        "usage": {"prompt_tokens":0,"completion_tokens":0,"total_tokens":0}
    })

@app.route("/v1/models", methods=["GET"])
def models():
    return jsonify({
        "object": "list",
        "data":   [{"id":"tesseract-ocr","object":"model","created":1700000000,"owned_by":"tesseract"}]
    })

@app.route("/health", methods=["GET"])
def health():
    try:
        ver = pytesseract.get_tesseract_version()
        return jsonify({"status":"ok","engine":"tesseract","version":str(ver)})
    except Exception as e:
        return jsonify({"status":"error","error":str(e)}), 500

@app.route("/", methods=["GET"])
def index():
    return jsonify({"service":"Tesseract OCR","status":"running"})

if __name__ == "__main__":
    log.info("OCR Service starting on :11435")
    app.run(host="0.0.0.0", port=11435, debug=False)
