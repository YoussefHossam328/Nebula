"""Refresh archived event CONTEXT; never infer Mars dose from DONKI flags."""
import json, os, urllib.request
from datetime import datetime, timezone
from pathlib import Path
path=Path(__file__).resolve().parent.parent/'src/data/donki-context.json'
key=os.environ.get('NASA_API_KEY') or 'DEMO_KEY'
# A bounded historical interval, with no secrets in generated metadata.
from urllib.parse import urlencode
url='https://api.nasa.gov/DONKI/SEP?'+urlencode({'startDate':'2024-05-10','endDate':'2024-05-21','api_key':key})
try:
    with urllib.request.urlopen(url,timeout=25) as response: payload=json.load(response)
    if not isinstance(payload,list): raise ValueError('Expected event array')
    records=[]
    for row in payload:
        if not isinstance(row,dict) or not isinstance(row.get('sepID'),str) or not isinstance(row.get('eventTime'),str): raise ValueError('Invalid event')
        records.append({'id':row['sepID'],'observedAt':row['eventTime'],'instruments':[v['displayName'] for v in (row.get('instruments') or []) if isinstance(v.get('displayName'),str)],'sourceUrl':row.get('link'),'associatedEventIds':[v['activityID'] for v in (row.get('linkedEvents') or []) if isinstance(v.get('activityID'),str)]})
    result={'schema':1,'status':'Archived NASA DONKI event context; not Mars dose measurements','retrievedAt':datetime.now(timezone.utc).isoformat(),'startDate':'2024-05-10','endDate':'2024-05-21','records':records}
    path.write_text(json.dumps(result,indent=2)+'\n')
    print(f'NASA DONKI archived context refreshed: {len(records)} records; '+('configured credential' if key!='DEMO_KEY' else 'public DEMO_KEY'))
except Exception:
    # Exception URLs can include credentials: do not log them.
    cache=json.loads(path.read_text())
    if cache.get('schema')!=1 or not isinstance(cache.get('records'),list): raise RuntimeError('No valid archived fallback available') from None
    print('NASA refresh unavailable; retaining labeled archived context with its original retrieval timestamp.')
