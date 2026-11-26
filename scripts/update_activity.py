import os,json,datetime,urllib.request
from pathlib import Path
now=datetime.datetime.now(datetime.timezone.utc)
start=(now-datetime.timedelta(days=364)).date()
repos=["Made-by-One/Made-by-One.github.io","Made-by-One/Devers-Workmods","Made-by-One/Devers-Launcher","Made-by-One/Devers-Packer"]
results={}
for repo in repos:
    counts={}
    page=1
    while True:
        url=f"https://api.github.com/repos/{repo}/commits?per_page=100&page={page}&since={start}T00:00:00Z"
        req=urllib.request.Request(url,headers={"Authorization":"Bearer "+os.environ["GH_TOKEN"],"Accept":"application/vnd.github+json"})
        with urllib.request.urlopen(req,timeout=30) as response:
            rows=json.load(response)
        for row in rows:
            if row["commit"]["message"].startswith("chore: refresh studio activity"): continue
            day=row["commit"]["committer"]["date"][:10]
            counts[day]=counts.get(day,0)+1
        if len(rows)<100: break
        page+=1
    results[repo]=counts
Path("data/activity.json").write_text(json.dumps({"from":str(start),"to":str(now.date()),"results":results},sort_keys=True,indent=2)+"\n")
