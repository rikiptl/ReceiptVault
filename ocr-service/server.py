#!/usr/bin/env python3
"""
OCR Service v2 — OpenAI-Compatible API using Tesseract + OpenCV
Improvements over v1:
  • OpenCV adaptive thresholding (much better on dim/angled photos)
  • Deskewing — corrects tilted/rotated receipts
  • Denoising — removes camera grain and speckle
  • Multi-PSM mode attempts with best-result selection
  • Better total/subtotal disambiguation with largest-amount fallback
  • Confidence scoring (0-100) based on fields found
  • Payment method detection (Visa, Mastercard, Cash, Apple Pay…)
  • Tip / gratuity extraction for restaurants
  • Subtotal extraction (separate from total)
  • Store phone number extraction
  • Extended category keywords (100+ merchants)
  • Auto-tag suggestions (business, reimbursable, food)
  • Full OCR text stored (no 1000-char truncation)
"""

import re
import base64
import json
import logging
from io import BytesIO
from datetime import datetime

import numpy as np
import cv2
from flask import Flask, request, jsonify
import pytesseract
from PIL import Image, ImageEnhance, ImageFilter, ImageOps

try:
    import pdf2image
    PDF_SUPPORT = True
except ImportError:
    PDF_SUPPORT = False

app = Flask(__name__)
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("ocr")

# ── Image preprocessing ───────────────────────────────────────────────────────

def pil_to_cv(image: Image.Image) -> np.ndarray:
    return cv2.cvtColor(np.array(image.convert("RGB")), cv2.COLOR_RGB2GRAY)

def cv_to_pil(arr: np.ndarray) -> Image.Image:
    return Image.fromarray(arr)

def deskew(image: Image.Image) -> Image.Image:
    """Detect and correct rotational skew using Hough line transform."""
    try:
        gray = pil_to_cv(image)
        edges = cv2.Canny(gray, 50, 150, apertureSize=3)
        lines = cv2.HoughLines(edges, 1, np.pi / 180, threshold=80)
        if lines is None or len(lines) == 0:
            return image
        angles = []
        for rho, theta in lines[:30, 0]:
            angle = (theta - np.pi / 2) * 180 / np.pi
            if -20 < angle < 20:
                angles.append(angle)
        if not angles:
            return image
        median_angle = float(np.median(angles))
        if abs(median_angle) < 0.4:
            return image          # not enough skew to bother
        log.info(f"Deskewing by {median_angle:.2f}°")
        return image.rotate(-median_angle, expand=True, fillcolor="white", resample=Image.BICUBIC)
    except Exception as e:
        log.warning(f"Deskew failed: {e}")
        return image

def denoise(image: Image.Image) -> Image.Image:
    """Fast Non-Local Means denoising to remove camera grain."""
    try:
        gray = pil_to_cv(image)
        denoised = cv2.fastNlMeansDenoising(gray, h=12, templateWindowSize=7, searchWindowSize=21)
        return cv_to_pil(denoised)
    except Exception as e:
        log.warning(f"Denoise failed: {e}")
        return image.convert("L")

def adaptive_threshold(image: Image.Image) -> Image.Image:
    """
    Adaptive Gaussian thresholding — handles uneven lighting much better
    than simple contrast enhancement.
    """
    try:
        gray = pil_to_cv(image)
        thresh = cv2.adaptiveThreshold(
            gray, 255,
            cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
            cv2.THRESH_BINARY,
            blockSize=15, C=4
        )
        return cv_to_pil(thresh)
    except Exception as e:
        log.warning(f"Adaptive threshold failed: {e}")
        return image.convert("L")

def upscale_if_needed(image: Image.Image, min_width: int = 1400) -> Image.Image:
    w, h = image.size
    if w < min_width:
        scale = min_width / w
        return image.resize((int(w * scale), int(h * scale)), Image.LANCZOS)
    return image

def preprocess(image: Image.Image) -> Image.Image:
    """Full preprocessing pipeline: upscale → deskew → denoise → adaptive threshold."""
    image = upscale_if_needed(image)
    image = deskew(image)
    image = denoise(image)
    image = adaptive_threshold(image)
    return image

# ── Multi-PSM OCR with best-result selection ──────────────────────────────────

PSM_MODES = [4, 6, 11]   # 4=single-col, 6=block, 11=sparse text

def score_text(text: str) -> float:
    """Heuristic score: more amounts + more words = better extraction."""
    amounts = len(re.findall(r'\d+[.,]\d{2}', text))
    words   = len(text.split())
    chars   = len(text)
    return amounts * 15 + words * 0.5 + chars * 0.02

def ocr_image(image: Image.Image) -> str:
    """Try multiple Tesseract PSM modes on a preprocessed image, return best."""
    best_text  = ""
    best_score = -1
    for psm in PSM_MODES:
        cfg  = f"--psm {psm} --oem 3"
        try:
            text  = pytesseract.image_to_string(image, config=cfg)
            score = score_text(text)
            log.debug(f"PSM {psm}: score={score:.1f} len={len(text)}")
            if score > best_score:
                best_score = score
                best_text  = text
        except Exception as e:
            log.warning(f"PSM {psm} failed: {e}")
    return best_text

def extract_text(b64: str, content_type: str) -> str:
    raw = base64.b64decode(b64)
    if "pdf" in content_type and PDF_SUPPORT:
        pages = pdf2image.convert_from_bytes(raw, dpi=300)
        return "\n\n--- PAGE BREAK ---\n\n".join(
            ocr_image(preprocess(p)) for p in pages
        )
    img = Image.open(BytesIO(raw))
    # Auto-orient from EXIF
    img = ImageOps.exif_transpose(img)
    return ocr_image(preprocess(img))

# ── Category detection ────────────────────────────────────────────────────────

CATEGORIES = {
    "Groceries": [
        "walmart","supermarket","grocery","costco","whole foods","trader joe",
        "kroger","safeway","aldi","lidl","food mart","food store","fresh market",
        "sprouts","publix","h-e-b","heb","wegmans","stop & shop","giant","food lion",
        "meijer","winco","winn-dixie","piggly","market basket","price chopper",
        "harris teeter","ralphs","smiths","fred meyer","vons","albertsons",
        "tom thumb","pavilions","smart & final","lucky","save mart","stater bros",
        "big lots","bj's","sam's club","sams club","costco","dollar general",
        "family dollar","dollar tree",
    ],
    "Food & Dining": [
        "restaurant","cafe","coffee","pizza","burger","sushi","mcdonald","starbucks",
        "subway","chipotle","taco bell","kfc","bistro","diner","bakery","chick-fil-a",
        "dominos","domino's","papa john","little caesars","five guys","shake shack",
        "in-n-out","popeyes","wendys","wendy's","sonic","dairy queen","panda express",
        "panera","olive garden","applebees","applebee's","buffalo wild wings","ihop",
        "denny's","waffle house","cracker barrel","outback","cheesecake factory",
        "red lobster","red robin","longhorn","texas roadhouse","ruby tuesday",
        "bar","pub","grill","eatery","kitchen","brasserie","trattoria","bistrot",
        "boba","smoothie","juice","donut","dunkin","krispy kreme","tim hortons",
    ],
    "Transport": [
        "uber","lyft","taxi","gas station","fuel","petrol","shell","bp","exxon",
        "chevron","mobil","arco","marathon","speedway","circle k","wawa","sunoco",
        "valero","pilot","flying j","loves","kwik trip","casey's","holiday stationstores",
        "parking","transit","airline","united","delta","american airlines","southwest",
        "jetblue","spirit","frontier","alaska airlines","train","amtrak","bus",
        "greyhound","megabus","enterprise","hertz","avis","budget","national car",
        "zipcar","turo","toll","metro","bart","mta","cta","septa","mbta",
    ],
    "Shopping": [
        "amazon","target","best buy","home depot","lowes","lowe's","ikea","macy's",
        "nordstrom","gap","h&m","zara","uniqlo","old navy","banana republic",
        "forever 21","express","victoria's secret","bath & body","bed bath",
        "tj maxx","tj-maxx","marshall's","ross","burlington","tuesday morning",
        "overstock","wayfair","pottery barn","crate & barrel","west elm","cb2",
        "williams-sonoma","brookstone","sharper image","apple store",
        "store","shop","mall","retail","outlet","clothing","boutique","depot",
        "ebay","etsy","shopify","wish","aliexpress",
    ],
    "Healthcare": [
        "pharmacy","cvs","walgreens","rite aid","medical","hospital","clinic",
        "dental","optical","doctor","health","urgent care","labcorp","quest",
        "kaiser","aetna","cigna","humana","blue cross","dermatology","pediatric",
        "orthopedic","cardiology","vision","eyecare","costco pharmacy",
        "walmart pharmacy","kroger pharmacy","safeway pharmacy",
    ],
    "Utilities": [
        "electric","water","gas company","internet","at&t","verizon","comcast",
        "xfinity","t-mobile","sprint","spectrum","cox","charter","frontier",
        "directv","dish network","hulu live","youtube tv","phone","telecom",
        "utility","energy","power","pge","pg&e","con ed","national grid",
        "duke energy","dominion","american electric","eversource","entergy",
    ],
    "Entertainment": [
        "cinema","amc","regal","cinemark","movie","theatre","theater","concert",
        "netflix","spotify","hulu","disney","streaming","game","steam","xbox",
        "playstation","nintendo","twitch","youtube","amazon prime","apple tv",
        "hbo","showtime","paramount","peacock","discovery","funko",
        "ticketmaster","stubhub","eventbrite","live nation","museum","zoo",
        "aquarium","theme park","disneyland","universal","six flags","legoland",
        "bowling","arcade","escape room","laser tag","mini golf",
    ],
    "Accommodation": [
        "hotel","motel","inn","airbnb","marriott","hilton","hyatt","holiday inn",
        "best western","comfort inn","fairfield","courtyard","hampton inn",
        "doubletree","sheraton","westin","w hotel","ritz","four seasons",
        "hostel","resort","suites","extended stay","red roof","quality inn",
        "days inn","super 8","la quinta","ramada","wyndham","choice hotels",
        "vrbo","booking.com","expedia","hotels.com",
    ],
    "Software/SaaS": [
        "subscription","license","software","app","digital","google","microsoft",
        "apple","adobe","dropbox","zoom","slack","github","gitlab","figma",
        "notion","airtable","monday.com","asana","trello","jira","confluence",
        "salesforce","hubspot","mailchimp","shopify","squarespace","wordpress",
        "cloudflare","digitalocean","aws","azure","heroku","netlify","vercel",
        "twilio","stripe","sendgrid","intercom","zendesk","freshdesk",
    ],
}

def guess_category(text: str) -> str:
    t = text.lower()
    best_cat   = "Other"
    best_count = 0
    for cat, keywords in CATEGORIES.items():
        count = sum(1 for k in keywords if k in t)
        if count > best_count:
            best_count = count
            best_cat   = cat
    return best_cat

# ── Auto-tag suggestions ──────────────────────────────────────────────────────

def suggest_tags(text: str, category: str) -> list:
    tags = []
    t    = text.lower()
    if any(k in t for k in ["business","office","conference","meeting","client",
                              "invoice","expense","work","professional"]):
        tags.append("business")
    if any(k in t for k in ["reimbursable","reimburse","expense report"]):
        tags.append("reimbursable")
    if category == "Software/SaaS" or any(k in t for k in ["subscription","monthly","annual","auto-renew","renewal"]):
        tags.append("subscription")
    if any(k in t for k in ["online","amazon","ebay","shipped","delivery","tracking"]):
        tags.append("online-order")
    return tags

# ── Currency detection ────────────────────────────────────────────────────────

def detect_currency(text: str) -> str:
    if re.search(r'£|GBP', text):       return "GBP"
    if re.search(r'€|EUR', text):       return "EUR"
    if re.search(r'¥|JPY', text):       return "JPY"
    if re.search(r'₹|INR', text):       return "INR"
    if re.search(r'A\$|AUD', text):     return "AUD"
    if re.search(r'C\$|CAD', text):     return "CAD"
    if re.search(r'CHF', text):         return "CHF"
    if re.search(r'kr|SEK|NOK|DKK', text): return "SEK"
    return "USD"

# ── Payment method detection ──────────────────────────────────────────────────

def detect_payment_method(text: str) -> str | None:
    t = text.lower()
    if re.search(r'\bapple\s*pay\b',  t):      return "Apple Pay"
    if re.search(r'\bgoogle\s*pay\b', t):      return "Google Pay"
    if re.search(r'\bsamsung\s*pay\b',t):      return "Samsung Pay"
    if re.search(r'\bcontactless\b',  t):      return "Contactless"
    if re.search(r'\bamex\b|american express', t): return "Amex"
    if re.search(r'\bmastercard\b|master card',t): return "Mastercard"
    if re.search(r'\bdiscover\b',     t):      return "Discover"
    if re.search(r'\bvisa\b',         t):      return "Visa"
    if re.search(r'\bdebit\b',        t):      return "Debit"
    if re.search(r'\bcredit\b',       t):      return "Credit Card"
    if re.search(r'\bcash\b|\btendered\b', t): return "Cash"
    if re.search(r'\bcheck\b|\bcheque\b', t):  return "Check"
    if re.search(r'\bvenmo\b',        t):      return "Venmo"
    if re.search(r'\bpaypal\b',       t):      return "PayPal"
    return None

# ── Amount helpers ────────────────────────────────────────────────────────────

def clean_amount(raw: str) -> str:
    raw = re.sub(r'[\$£€¥₹\s,]', '', raw)
    # Handle European decimal: "18,83" → "18.83"
    if re.match(r'^\d+,\d{2}$', raw):
        raw = raw.replace(',', '.')
    parts = raw.split('.')
    if len(parts) > 2:
        raw = parts[0] + '.' + parts[-1]
    try:
        return f"{float(raw):.2f}"
    except Exception:
        return raw

def to_float(s: str) -> float | None:
    try:
        return float(s.replace(',', '.'))
    except Exception:
        return None

# ── Receipt parser ────────────────────────────────────────────────────────────

SKIP_MERCHANT = re.compile(
    r'^(receipt|invoice|bill|order|date|time|tel|phone|fax|address|www|http|'
    r'save money|live better|thank you|welcome|visit us|open|closed|hours|'
    r'store\s*#|st\s*#|op\s*#|terminal|transaction|approval|account|ref|'
    r'barcode|loyalty|member|card\s*#|rewards|points|tax|vat)',
    re.I
)

SKIP_ITEMS = re.compile(
    r'^(total|subtotal|sub.?total|tax|vat|gst|hst|pst|qst|'
    r'tend|change|cash|credit|debit|visa|mastercard|amex|discover|'
    r'tip|gratuity|service\s*charge|discount|savings|balance|amount\s*due|'
    r'st\s*#|op\s*#|te\s*#|tr\s*#|tc\s*#|account|approval|ref|trans|'
    r'terminal|validation|payment|items\s*sold|low\s*price|member|'
    r'barcode|rewards|points)',
    re.I
)

# All patterns that indicate a TOTAL line (in priority order)
TOTAL_PATTERNS = [
    r'(?:GRAND\s+TOTAL|TOTAL\s+AMOUNT|AMOUNT\s+DUE|BALANCE\s+DUE|TOTAL\s+DUE|YOU\s+PAID)'
    r'[:\s]*[\$£€¥₹]?\s*(\d{1,6}[.,]\d{2})',
    r'^TOTAL[:\s]+[\$£€¥₹]?\s*(\d{1,6}[.,]\d{2})',
    r'^TOTAL\s{2,}[\$£€¥₹]?\s*(\d{1,6}[.,]\d{2})',
    r'(?:NET\s+)?TOTAL\s*[\$£€¥₹]\s*(\d{1,6}[.,]\d{2})',
    r'[\$£€¥₹]\s*(\d{1,6}[.,]\d{2})\s*(?:TOTAL|DUE)',
    r'^CHARGE[:\s]+[\$£€¥₹]?\s*(\d{1,6}[.,]\d{2})',
]

SUBTOTAL_PATTERNS = [
    r'^(?:SUBTOTAL|SUB\s*TOTAL|SUB-TOTAL|MERCHANDISE)[:\s]+[\$£€¥₹]?\s*(\d{1,6}[.,]\d{2})',
    r'SUBTOTAL\s+[\$£€¥₹]?\s*(\d{1,6}[.,]\d{2})',
]

TAX_PATTERNS = [
    r'^(?:TAX|GST|VAT|HST|PST|QST|SALES\s+TAX|STATE\s+TAX|CITY\s+TAX|'
    r'LOCAL\s+TAX|TAX\s+\d+%?)[:\s]+[\$£€¥₹]?\s*(\d{1,6}[.,]\d{2})',
]

TIP_PATTERNS = [
    r'^(?:TIP|GRATUITY|SERVICE\s+CHARGE|AUTO\s+GRAT|SUGGESTED\s+TIP)'
    r'[:\s]+[\$£€¥₹]?\s*(\d{1,6}[.,]\d{2})',
]

DATE_PATTERNS = [
    r'\b(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4})\b',
    r'\b(\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2})\b',
    r'\b(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2})\b',
    r'\b(\w{3,9}\s+\d{1,2},?\s+\d{4})\b',
    r'\b(\d{1,2}\s+\w{3,9}\s+\d{4})\b',
    r'\b(\d{8})\b',   # 20251026
]

PHONE_PATTERN = re.compile(
    r'\(?\d{3}\)?[\s\-\.]\d{3}[\s\-\.]\d{4}'
)

ITEM_PATTERNS = [
    re.compile(r'^(.+?)\s{2,}[\$£€¥₹]\s*(\d{1,5}[.,]\d{2})\s*$'),
    re.compile(r'^(.+?)\s{3,}(\d{1,5}[.,]\d{2})\s*[A-Z]?\s*$'),  # with tax flag
    re.compile(r'^(.+?)\s{2,}(\d{1,5}[.,]\d{2})\s*$'),
]

def extract_merchant(lines: list) -> str:
    """Try the first 10 lines; pick first meaningful, non-boilerplate line."""
    for line in lines[:10]:
        clean = line.strip("*-=. \t#|")
        if (3 <= len(clean) <= 60
                and not re.match(r'^[\d\s\-\/\.\*\#\=\|]+$', clean)
                and not SKIP_MERCHANT.match(clean)):
            return clean
    return ""

def first_match(patterns: list, text: str, flags=re.I | re.M) -> str | None:
    for pat in patterns:
        m = re.search(pat, text, flags)
        if m:
            return clean_amount(m.group(1))
    return None

def extract_total_with_fallback(text: str, lines: list, subtotal: str | None) -> str:
    """Try labelled patterns first; fall back to largest amount on receipt."""
    total = first_match(TOTAL_PATTERNS, text)
    if total:
        return total

    # Fallback: collect all dollar amounts, exclude subtotal, take largest
    all_amounts = re.findall(r'[\$£€¥₹]?\s*(\d{1,6}[.,]\d{2})', text)
    nums = [to_float(clean_amount(a)) for a in all_amounts]
    nums = [n for n in nums if n is not None and n > 0.01]

    # Exclude subtotal from candidates
    if subtotal:
        sub_val = to_float(subtotal)
        if sub_val:
            nums = [n for n in nums if abs(n - sub_val) > 0.001]

    if nums:
        return f"{max(nums):.2f}"
    return ""

def parse_receipt(text: str) -> dict:
    lines = [ln.strip() for ln in text.split("\n") if ln.strip()]
    log.info(f"Parsing: {len(lines)} lines, {len(text)} chars")

    result = {
        "merchant":       "",
        "date":           "",
        "total":          "",
        "subtotal":       "",
        "tax":            "",
        "tip":            "",
        "currency":       "USD",
        "paymentMethod":  None,
        "phone":          None,
        "category":       "",
        "suggestedTags":  [],
        "description":    text.strip(),   # full text for search
        "notes":          "",
        "items":          [],
        "confidence":     0,
    }

    result["merchant"]      = extract_merchant(lines)
    result["currency"]      = detect_currency(text)
    result["paymentMethod"] = detect_payment_method(text)
    result["category"]      = guess_category(text)

    # Date
    for pat in DATE_PATTERNS:
        m = re.search(pat, text, re.I)
        if m:
            result["date"] = m.group(1)
            break

    # Tax
    result["tax"] = first_match(TAX_PATTERNS, text) or ""

    # Tip
    result["tip"] = first_match(TIP_PATTERNS, text) or ""

    # Subtotal
    result["subtotal"] = first_match(SUBTOTAL_PATTERNS, text) or ""

    # Total (with fallback)
    result["total"] = extract_total_with_fallback(text, lines, result["subtotal"] or None)

    # Phone
    pm = PHONE_PATTERN.search(text)
    if pm:
        result["phone"] = pm.group(0).strip()

    # Line items
    items_seen = set()
    for line in lines:
        for pat in ITEM_PATTERNS:
            m = pat.match(line)
            if m:
                name  = m.group(1).strip().strip("*-= \t")
                price = clean_amount(m.group(2))
                key   = (name.lower(), price)
                if (2 <= len(name) <= 60
                        and not SKIP_ITEMS.match(name)
                        and key not in items_seen):
                    result["items"].append({"name": name, "total": price})
                    items_seen.add(key)
                break

    # Auto-tag suggestions
    result["suggestedTags"] = suggest_tags(text, result["category"])

    # Confidence score
    score = 0
    if result["merchant"]:       score += 25
    if result["date"]:           score += 25
    if result["total"]:          score += 30
    if result["items"]:          score += 10
    if result["category"] != "Other": score += 10
    result["confidence"] = score

    log.info(
        f"merchant='{result['merchant']}' date='{result['date']}' "
        f"total='{result['total']}' tax='{result['tax']}' tip='{result['tip']}' "
        f"items={len(result['items'])} cat='{result['category']}' "
        f"payment='{result['paymentMethod']}' confidence={result['confidence']}"
    )
    return result

# ── API endpoints ─────────────────────────────────────────────────────────────

@app.route("/v1/chat/completions", methods=["POST"])
def chat_completions():
    data     = request.get_json(force=True, silent=True) or {}
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
        "merchant":"","date":"","total":"","subtotal":"","tax":"","tip":"",
        "currency":"USD","paymentMethod":None,"phone":None,
        "category":"","suggestedTags":[],"description":"",
        "notes":"","items":[],"confidence":0,
    }

    return jsonify({
        "id":      f"ocr-{int(datetime.now().timestamp())}",
        "object":  "chat.completion",
        "created": int(datetime.now().timestamp()),
        "model":   "tesseract-ocr",
        "choices": [{
            "index": 0,
            "message": {"role": "assistant", "content": json.dumps(parsed)},
            "finish_reason": "stop"
        }],
        "usage": {"prompt_tokens":0,"completion_tokens":0,"total_tokens":0}
    })

@app.route("/v1/models", methods=["GET"])
def models():
    return jsonify({
        "object": "list",
        "data": [{"id":"tesseract-ocr","object":"model","created":1700000000,"owned_by":"tesseract"}]
    })

@app.route("/health", methods=["GET"])
def health():
    try:
        ver = pytesseract.get_tesseract_version()
        return jsonify({"status":"ok","engine":"tesseract","version":str(ver),"opencv":cv2.__version__})
    except Exception as e:
        return jsonify({"status":"error","error":str(e)}), 500

@app.route("/", methods=["GET"])
def index():
    return jsonify({"service":"Tesseract OCR v2","status":"running"})

if __name__ == "__main__":
    log.info("OCR Service v2 starting on :11435")
    app.run(host="0.0.0.0", port=11435, debug=False)
