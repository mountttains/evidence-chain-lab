"""Fetch and verify publisher data; requires pypdf and curl. Never calls a model."""
import hashlib,json,re,subprocess
from pathlib import Path
from datetime import datetime,timezone
from pypdf import PdfReader
root=Path(__file__).resolve().parents[1]
target=root/".tools"/"apple-financials.pdf"
target.parent.mkdir(exist_ok=True)
data=json.loads((root/"data/case.json").read_text(encoding="utf-8"))
url=data["sources"][0]["url"]
if not target.exists():
 subprocess.run(["curl.exe" if __import__("os").name=="nt" else "curl","-fL","--retry","2",url,"-o",str(target)],check=True)
reader=PdfReader(target)
text=reader.pages[0].extract_text()
checks=[]
for label,key in [("Operating income","operating"),("Net income","net"),("Gross margin","gross"),("Provision for income taxes","tax")]:
 block=text.split(label,1)[1]
 nums=re.findall(r"(?<![A-Za-z])\d[\d,]*",block)[:4]
 values=[int(n.replace(",","")) for n in nums]
 expected=[data["quarter"]["current"][key],data["quarter"]["prior"][key],data["annual"]["current"][key],data["annual"]["prior"][key]]
 assert values==expected,(key,values,expected)
 checks.append({"field":key,"sourcePage":1,"sourceValues":values,"passed":True})
p4=reader.pages[3].extract_text()
assert "10,246" in p4 and "$10.2 billion" in p4
record={"sourceURL":url,"retrievedAt":datetime.now(timezone.utc).isoformat(),"sha256":hashlib.sha256(target.read_bytes()).hexdigest(),"pageCount":len(reader.pages),"checks":checks,"taxAdjustmentVerified":10246,"note":"Other row values manually transcribed and cross-checked against page 1. Financial statements are unaudited earnings-release materials."}
(root/"data/provenance.json").write_text(json.dumps(record,ensure_ascii=False,indent=2),encoding="utf-8")
print(json.dumps(record,ensure_ascii=False,indent=2))