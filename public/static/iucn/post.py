import requests, json, time
from csv import DictReader

es = 'http://gateway:9200/contentmine/'
tp = 'redlist'

mapping = json.load(open('/home/cloo/static/mapping.json','r'))
requests.delete(es + tp)
requests.post(es + '_mapping/' + tp, data=json.dumps(mapping))

counter = 0
inp = DictReader(open('iucn.csv'))
for row in inp:
    new = {}
    for k, v in row.iteritems():
        kl = k.replace(' ','_').replace('/','_').lower().strip()
        vv = unicode(v.strip().strip('(').strip(')'), 'latin-1')
        if kl.startswith('common_names'):
            if 'common_names' not in new:
                new['common_names'] = []
            vv = [i.strip() for i in vv.split(',') if len(i.strip()) > 0]
            for vvv in vv:
                if vvv not in new['common_names']:
                    new['common_names'].append(vvv)
        if kl == 'synonyms':
            vv = [i.strip() for i in vv.split('|') if len(i.strip()) > 0]
        new[kl] = vv
    r = requests.post(es + tp, data=json.dumps(new))
    time.sleep(0.05)
    counter += 1
    #if counter < 10: print new
    if r.status_code != 201:
        print counter, r.status_code

print counter
