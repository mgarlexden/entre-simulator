import sys, zipfile
import pandas as pd

ZIP = sys.argv[1]
OUT = sys.argv[2]
z = zipfile.ZipFile(ZIP)
name = [i.filename for i in z.infolist() if '서울' in i.filename][0]
cols = ['상호명', '지점명', '상권업종대분류코드', '상권업종중분류코드', '상권업종중분류명', '상권업종소분류코드', '상권업종소분류명',
        '시군구명', '행정동코드', '행정동명', '층정보']
df = pd.read_csv(z.open(name), usecols=cols, dtype=str, encoding='utf-8-sig')
df = df[df['상권업종대분류코드'] == 'I2']
df.to_pickle(OUT)
print(len(df))
print(df.groupby(['상권업종중분류코드', '상권업종중분류명']).size().to_string())
