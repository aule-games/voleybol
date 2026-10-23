/** Manually curated factual selections and original game costs; no price-feed import. */
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const legacy = JSON.parse(readFileSync(new URL('../tests/data/legacy-real-content.json', import.meta.url)));
const checkedAt = '2026-10-23T12:45:00.000Z';
const urls = {
 br:'https://br.volleyballworld.com/volleyball/competitions/volleyball-nations-league/news/elenco-selecao-feminina-vnl-2025-anunciado',
 jp:'https://en.volleyballworld.com/volleyball/competitions/volleyball-nations-league/2025/news/akbas-selects-34-players-first-call-up-japan',
 it:'https://www.federvolley.it/campionato-del-mondo-le-14-azzurre-partenza-la-thailandia',
 rs:'https://en.volleyballworld.com/news/boskovic-lead-renovated-serbian-squad-2025',
 pl:'https://en.volleyballworld.com/news/poland-2025-roster-mixes-veterans-youngsters',
 us:'https://usavolleyball.org/story/u-s-women-ready-for-2025-world-championship-in-thailand/',
 cn:'https://en.volleyballworld.com/news/with-new-coach-china-start-preparations-2025',
 guidetti:'https://www.vakifbanksporkulubu.com/tr/haber-detay/giovanni-guidetti-ile-20-yila---n2677',
 santarelli:'https://championsleague.cev.eu/en/articles/2024/imoco-conegliano-earn-the-champions-league-crown-after-dramatic-five-setter/',
 guimaraes:'https://cbv.com.br/noticias/volei-de-quadra/2025-07-31/jose-roberto-guimaraes-convoca-15-jogadoras-para-os-treinos-visando-o-campeonato-mundial',
 sullivan:'https://usavolleyball.org/story/usa-volleyball-names-erik-sullivan-as-new-head-coach-of-the-u-s-womens-national-team/',
};
const trCosts=[7,5,12,5,9,7,5,5,9,7,5,3,7,5];
const players=legacy.roster.players.map((p,i)=>({...p,cost:trCosts[i],sourceLabel:'2026–27 Sultanlar Ligi kaydı'}));
function group(countryCode, source, rows, sourceLabel='2025 millî takım çağrısı') {
 for(const row of rows.trim().split('\n')) { const [slug,name,role,cost]=row.split('|'); players.push({id:`real-${countryCode.toLowerCase()}-${slug}`,name,role,cost:Number(cost),clubId:'',countryCode,sourceUrl:urls[source],sourceLabel}); }
}
group('BR','br',`
macris|Macris|setter|7
roberta|Roberta|setter|5
rosamaria|Rosamaria|opposite|7
kisy|Kisy|opposite|5
tainara|Tainara|opposite|5
gabi|Gabi Guimarães|outside|12
ana-cristina|Ana Cristina|outside|9
julia-bergmann|Julia Bergmann|outside|9
helena|Helena|outside|3
diana|Diana|middle|5
julia-kudiess|Julia Kudiess|middle|7
lorena|Lorena|middle|3
lais|Laís|libero|5
marcelle|Marcelle|libero|3`);
group('JP','jp',`
seki|Nanami Seki|setter|7
matsui|Tamaki Matsui|setter|5
wada|Yukiko Wada|opposite|7
nonaka|Rui Nonaka|opposite|3
ishikawa|Mayu Ishikawa|outside|9
sato|Yoshino Sato|outside|7
kurogo|Ai Kurogo|outside|5
osanai|Miwako Osanai|outside|3
araki|Ayaka Araki|middle|5
yamada|Nichika Yamada|middle|5
miyabe|Airi Miyabe|middle|5
shimamura|Haruyo Shimamura|middle|5
kojima|Manami Kojima|libero|7
fukudome|Satomi Fukudome|libero|5`);
group('IT','it',`
orro|Alessia Orro|setter|9
cambi|Carlotta Cambi|setter|5
egonu|Paola Egonu|opposite|12
antropova|Ekaterina Antropova|opposite|9
sylla|Myriam Sylla|outside|9
giovannini|Gaia Giovannini|outside|5
omoruyi|Loveth Omoruyi|outside|5
nervini|Stella Nervini|outside|5
danesi|Anna Danesi|middle|9
fahr|Sarah Fahr|middle|9
sartori|Benedetta Sartori|middle|5
akrari|Yasmina Akrari|middle|3
de-gennaro|Monica De Gennaro|libero|9
fersino|Eleonora Fersino|libero|5`, '2025 Dünya Şampiyonası kadrosu');
group('RS','rs',`
perovic|Rada Perović|setter|5
mirkovic|Slađana Mirković|setter|5
boskovic|Tijana Bošković|opposite|12
bukilic|Vanja Bukilić|opposite|5
uzelac|Aleksandra Uzelac|outside|7
milenkovic|Bojana Milenković|outside|5
dangubic|Katarina Dangubić|outside|5
tica|Branka Tica|outside|3
kurtagic|Hena Kurtagić|middle|7
aleksic|Maja Aleksić|middle|7
kocic|Jovana Kocić|middle|3
milojevic|Ljubica Milojević|middle|3
pusic|Teodora Pušić|libero|5
jegdic|Aleksandra Jegdić|libero|5`);
group('PL','pl',`
wenerska|Katarzyna Wenerska|setter|5
kowalewska|Marlena Kowalewska|setter|5
stysiak|Magdalena Stysiak|opposite|9
smarzek|Malwina Smarzek|opposite|5
lukasik|Martyna Łukasik|outside|7
czyrnianska|Martyna Czyrniańska|outside|7
rozanski|Olivia Różański|outside|5
korneluk|Agnieszka Korneluk|middle|9
jurczyk|Magdalena Jurczyk|middle|5
szczyglowska|Aleksandra Szczygłowska|libero|5`);
group('US','us',`
poulter|Jordyn Poulter|setter|7
kaahaaina-torres|Saige Ka’aha’aina-Torres|setter|3
madisen-skinner|Madisen Skinner|opposite|7
samedy|Stephanie Samedy|opposite|5
avery-skinner|Avery Skinner|outside|9
franklin|Sarah Franklin|outside|5
frantti|Ali Frantti|outside|5
ogbogu|Chiaka Ogbogu|middle|9
rettke|Dana Rettke|middle|7
hentz|Morgan Hentz|libero|7`, '2025 Dünya Şampiyonası kadrosu');
group('CN','cn',`
zhang-zixuan|Zhang Zixuan|setter|5
yin-xiaolan|Yin Xiaolan|setter|3
gong-xiangyu|Gong Xiangyu|opposite|9
yang-shuming|Yang Shuming|opposite|3
li-yingying|Li Yingying|outside|9
wu-mengjie|Wu Mengjie|outside|7
zhuang-yushan|Zhuang Yushan|outside|5
wang-yuanyuan|Wang Yuanyuan|middle|7
wang-aoqian|Wang Aoqian|middle|3
wang-mengjie|Wang Mengjie|libero|7`);
const coaches=[
 ['santarelli','Daniele Santarelli',6,'Conegliano · 2024 Avrupa şampiyonu teknik ekibi','santarelli'],
 ['velasco','Julio Velasco',6,'İtalya · 2025 millî takım başantrenörü','it'],
 ['guimaraes','José Roberto Guimarães',5,'Brezilya · 2025 millî takım başantrenörü','guimaraes'],
 ['guidetti','Giovanni Guidetti',5,'VakıfBank · 2025–28 sözleşme duyurusu','guidetti'],
 ['terzic','Zoran Terzić',5,'Sırbistan · 2025 millî takım başantrenörü','rs'],
 ['lavarini','Stefano Lavarini',4,'Polonya · 2025 millî takım başantrenörü','pl'],
 ['akbas','Ferhat Akbaş',3,'Japonya · 2025 millî takım başantrenörü','jp'],
 ['barbolini','Massimo Barbolini',3,'İtalya · 2025 millî takım yardımcı antrenörü','it'],
 ['sullivan','Erik Sullivan',3,'ABD · 2025 başantrenörlük duyurusu','sullivan'],
 ['zhao','Zhao Yong',2,'Çin · 2025 millî takım başantrenörü','cn'],
].map(([id,name,cost,reference,source])=>({id:`coach-${id}`,name,cost,reference,sourceUrl:urls[source]}));
const questions=legacy.quiz.questions.map(q=>({...q,category:'league'}));
let number=11;
function qs(category,season,url,title,rows) {
 for(const [text,correct,other,explanation] of rows) {
  const id=`iq-${String(number++).padStart(3,'0')}`; const choices=[correct,...other]; const shift=number%4;
  const arranged=[...choices.slice(shift),...choices.slice(0,shift)];
  questions.push({id,revision:1,text,choices:arranged.map((text,i)=>({id:`${id}-${i}`,text})),correctId:`${id}-${arranged.indexOf(correct)}`,explanation,season,source:{title,url,checkedAt},category});
 }
}
const roles=['Pasör','Pasör çaprazı','Smaçör','Orta oyuncu','Libero'];
const roleTR={setter:'Pasör',opposite:'Pasör çaprazı',outside:'Smaçör',middle:'Orta oyuncu',libero:'Libero'};
for(const index of [0,2,5,8,12]) {
 const p=players[index],role=roleTR[p.role];
 qs('league','2026–27 Sultanlar Ligi',p.sourceUrl,'Resmî lig oyuncu kaydı',[[`2026–27 Sultanlar Ligi kaydında ${p.name} hangi pozisyonda yer alır?`,role,roles.filter(r=>r!==role).slice(0,3),`Lig kaydında ${p.name}, ${role.toLocaleLowerCase('tr-TR')} olarak listelenir.`]]);
}
const clubNames={vakifbank:'VakıfBank',fenerbahce:'Fenerbahçe Medicana',thy:'Türk Hava Yolları',eczacibasi:'Eczacıbaşı Peron İstanbul',galatasaray:'Galatasaray Daikin'};
for(const index of [0,1,6,7]) {
 const p=players[index],club=clubNames[p.clubId];
 qs('league','2026–27 Sultanlar Ligi',p.sourceUrl,'Resmî lig oyuncu kaydı',[[`2026–27 Sultanlar Ligi kaydına göre ${p.name} hangi kulüptedir?`,club,Object.values(clubNames).filter(c=>c!==club).slice(0,3),`${p.name}, bu sezonun lig kaydında ${club} kadrosundadır.`]]);
}
qs('league','2025–28 sözleşme duyurusu',urls.guidetti,'VakıfBank resmî duyurusu',[[`Giovanni Guidetti ile 2025–28 dönemini kapsayan yeni sözleşme duyuran kulüp hangisidir?`,'VakıfBank',['Fenerbahçe','Eczacıbaşı','Galatasaray'],'VakıfBank, Guidetti ile üç sezonluk sözleşme uzatmasını duyurdu.']]);
qs('vnl','VNL 2021','https://usavolleyball.org/story/triple-triumph-u-s-women-win-3rd-straight-vnl-title/','USA Volleyball · VNL 2021',[
 ['2021 kadınlar VNL şampiyonu hangi ülkeydi?','ABD',['Brezilya','İtalya','Japonya'],'ABD, 2021 finalinde Brezilya’yı yenerek kupayı kazandı.'],
 ['ABD, 2021 kadınlar VNL finalinde hangi ülkeyi yendi?','Brezilya',['Türkiye','Çin','Sırbistan'],'2021 finalinin iki takımı ABD ve Brezilya’ydı.'],
 ['2021 kadınlar VNL turnuvasının MVP’si kimdi?','Michelle Bartsch-Hackley',['Jordan Larson','Gabi Guimarães','Tijana Bošković'],'MVP ödülü ABD’li smaçör Michelle Bartsch-Hackley’ye verildi.'],
 ['2021 kadınlar VNL en iyi pasör ödülünü kim aldı?','Jordyn Poulter',['Cansu Özbay','Alessia Orro','Macris'],'ABD’li Jordyn Poulter en iyi pasör seçildi.'],
]);
qs('vnl','VNL 2022','https://en.volleyballworld.com/news/womens-vnl-medal-matches','Volleyball World · VNL 2022',[
 ['2022’de ilk kadınlar VNL şampiyonluğunu kazanan ülke hangisiydi?','İtalya',['Sırbistan','Japonya','Polonya'],'İtalya, finalde Brezilya’yı yenerek ilk VNL kupasını aldı.'],
 ['2022 kadınlar VNL finali hangi şehirde oynandı?','Ankara',['İstanbul','Bangkok','Roma'],'2022 VNL final etabının ev sahibi Ankara’ydı.'],
 ['2022 kadınlar VNL bronz madalyasını hangi ülke aldı?','Sırbistan',['Türkiye','Çin','ABD'],'Sırbistan, üçüncülük maçında Türkiye’yi yenerek bronz aldı.'],
 ['İtalya, 2022 kadınlar VNL finalinde Brezilya’yı kaç kaç yendi?','3-0',['3-1','3-2','2-3'],'İtalya finalde set vermedi ve 3-0 kazandı.'],
]);
qs('vnl','VNL 2023','https://en.volleyballworld.com/volleyball/competitions/volleyball-nations-league/news/vargas-takes-the-vnl-by-storm-with-mvp-award','Volleyball World · VNL 2023 ödülleri',[
 ['2023’te ilk kadınlar VNL şampiyonluğuna ulaşan ülke hangisiydi?','Türkiye',['Japonya','Polonya','Çin'],'Türkiye, 2023 VNL’de tarihinin ilk şampiyonluğunu kazandı.'],
 ['2023 kadınlar VNL MVP ödülünü kim kazandı?','Melissa Vargas',['Ebrar Karakurt','Paola Egonu','Li Yingying'],'Melissa Vargas turnuvanın en değerli oyuncusu seçildi.'],
 ['2023 kadınlar VNL en iyi libero ödülü kime gitti?','Gizem Örge',['Simge Aköz','Monica De Gennaro','Manami Kojima'],'Gizem Örge, 2023 VNL’nin en iyi liberosu seçildi.'],
 ['2023 kadınlar VNL rüya takımının pasörü kimdi?','Diao Linyu',['Cansu Özbay','Alessia Orro','Jordyn Poulter'],'Çinli Diao Linyu en iyi pasör ödülünü aldı.'],
]);
qs('vnl','VNL 2024','https://www.fivb.com/egonu-leads-italy-to-their-second-vnl-title-japan-settles-for-historic-silver-poland-defend-their-bronze/','FIVB · VNL 2024',[
 ['2024 kadınlar VNL’de tarihî gümüş madalya kazanan Asya takımı hangisiydi?','Japonya',['Çin','Tayland','Güney Kore'],'Japonya, İtalya ile oynadığı finalin ardından gümüş madalya aldı.'],
 ['2024 kadınlar VNL bronz madalyasını hangi ülke kazandı?','Polonya',['Türkiye','Brezilya','ABD'],'Polonya, Brezilya’yı beş sette yenerek üçüncü oldu.'],
 ['2024 kadınlar VNL MVP’si hangi İtalyan oyuncuydu?','Paola Egonu',['Alessia Orro','Myriam Sylla','Anna Danesi'],'Paola Egonu, şampiyon İtalya’nın MVP ödülünü kazanan oyuncusuydu.'],
 ['2024 kadınlar VNL en iyi libero ödülünü kim kazandı?','Manami Kojima',['Gizem Örge','Monica De Gennaro','Wang Mengjie'],'Japonya’dan Manami Kojima en iyi libero seçildi.'],
]);
qs('vnl','VNL 2025','https://it.volleyballworld.com/volleyball/competitions/volleyball-nations-league/news/volleyball-nations-league-2025-l-italia-femminile-campionessa-per-la-terza-volta','Volleyball World · VNL 2025',[
 ['2025 kadınlar VNL kupasını hangi ülke kazandı?','İtalya',['Brezilya','Polonya','Türkiye'],'İtalya, 2025 VNL’yi şampiyon tamamladı.'],
 ['2025 kadınlar VNL’nin MVP seçilen liberosu kimdi?','Monica De Gennaro',['Gizem Örge','Manami Kojima','Wang Mengjie'],'Monica De Gennaro hem en iyi libero hem MVP seçildi.'],
 ['İtalya’nın 2025 kadınlar VNL finalindeki rakibi hangi ülkeydi?','Brezilya',['Japonya','Türkiye','ABD'],'İtalya finalde Brezilya’yı 3-1 yendi.'],
 ['2025 kadınlar VNL rüya takımının pasör çaprazı kimdi?','Paola Egonu',['Melissa Vargas','Tijana Bošković','Magdalena Stysiak'],'En iyi pasör çaprazı ödülünü Paola Egonu aldı.'],
]);
qs('olympics','Paris 2024','https://www.fivb.com/italy-beat-the-usa-to-secure-first-olympic-title/','FIVB · Paris 2024 finali',[
 ['Paris 2024 kadınlar salon voleybolunda altın madalyayı hangi ülke kazandı?','İtalya',['ABD','Brezilya','Türkiye'],'İtalya, Paris’te ilk olimpiyat şampiyonluğuna ulaştı.'],
 ['Paris 2024 kadınlar voleybol finalinde İtalya’nın rakibi kimdi?','ABD',['Brezilya','Sırbistan','Çin'],'Finalde İtalya ile ABD karşılaştı.'],
 ['Paris 2024 kadınlar voleybol finalini İtalya hangi skorla kazandı?','3-0',['3-1','3-2','2-3'],'İtalya finali set vermeden 3-0 kazandı.'],
 ['Şampiyon İtalya, Paris 2024 kadınlar voleybol turnuvasının tamamında kaç set kaybetti?','1',['0','3','5'],'İtalya altı galibiyet alırken yalnızca bir set kaybetti.'],
]);
qs('olympics','Paris 2024 ödülleri','https://en.volleyballworld.com/volleyball/competitions/volleyball-olympic-games-paris-2024/news/egonu-crowned-as-mvp-in-italy-s-golden-campaign-in-paris','Volleyball World · Paris ödülleri',[
 ['Paris 2024 kadınlar voleybol turnuvasının MVP’si kimdi?','Paola Egonu',['Melissa Vargas','Gabi Guimarães','Jordan Larson'],'Paola Egonu olimpiyat turnuvasının MVP’si seçildi.'],
 ['Paris 2024 kadınlar voleybolunda en iyi pasör kim seçildi?','Alessia Orro',['Jordyn Poulter','Cansu Özbay','Roberta'],'Alessia Orro en iyi pasör ödülünü aldı.'],
 ['Paris 2024 kadınlar voleybolunda en iyi libero ödülünü kim aldı?','Monica De Gennaro',['Gizem Örge','Justine Wong-Orantes','Manami Kojima'],'İtalya’dan Monica De Gennaro en iyi libero seçildi.'],
 ['Paris 2024 kadınlar rüya takımında yer alan ABD’li orta oyuncu kimdi?','Chiaka Ogbogu',['Dana Rettke','Haleigh Washington','Brionne Butler'],'Chiaka Ogbogu, rüya takımın iki orta oyuncusundan biriydi.'],
]);
qs('olympics','Paris 2024 bronz maçı','https://www.fivb.com/brazil-bounce-back-and-leave-paris-with-bronze/','FIVB · Paris bronz maçı',[
 ['Paris 2024 kadınlar voleybolunda bronz madalyayı hangi ülke aldı?','Brezilya',['Türkiye','Çin','Sırbistan'],'Brezilya üçüncülük maçını kazanarak bronz madalya aldı.'],
 ['Brezilya, Paris 2024 kadınlar voleybol bronz maçında kimi yendi?','Türkiye',['Japonya','ABD','İtalya'],'Bronz maçında Brezilya ile Türkiye karşılaştı.'],
 ['Paris 2024’te Brezilya kadın voleybol takımı bronz maçını kaç kaç kazandı?','3-1',['3-0','3-2','2-3'],'Brezilya, Türkiye’yi 3-1 yenerek üçüncü oldu.'],
 ['Paris’ten önceki Tokyo 2020’de Brezilya kadın voleybol takımı hangi madalyayı almıştı?','Gümüş',['Altın','Bronz','Madalya alamadı'],'Brezilya, Tokyo’da gümüş; Paris’te bronz madalya kazandı.'],
]);
qs('olympics','Tokyo 2020 · 2021’de oynandı','https://usavolleyball.org/story/gold-at-last-u-s-women-beat-brazil-to-win-olympic-crown/','USA Volleyball · Tokyo finali',[
 ['Tokyo 2020 kadınlar salon voleybolunda şampiyon hangi ülkeydi?','ABD',['Brezilya','Sırbistan','Çin'],'ABD kadın takımı Tokyo’da ilk olimpiyat altınını kazandı.'],
 ['ABD, Tokyo 2020 kadınlar voleybol finalinde hangi ülkeyi yendi?','Brezilya',['İtalya','Sırbistan','Japonya'],'Finalde ABD’nin karşısında Brezilya vardı.'],
 ['ABD, Tokyo 2020 kadınlar voleybol finalini hangi skorla kazandı?','3-0',['3-1','3-2','1-3'],'ABD, Brezilya’yı üç sette yendi.'],
 ['Tokyo 2020 kadınlar voleybol finali hangi salonda oynandı?','Ariake Arena',['Huamark Salonu','Stark Arena','Ankara Spor Salonu'],'Tokyo’daki finalin salonu Ariake Arena’ydı.'],
]);
qs('olympics','Tokyo 2020 ödülleri','https://en.volleyballworld.com/volleyball/competitions/olympics-2020/news/larson-leads-women-s-tokyo-2020-dream-team','Volleyball World · Tokyo ödülleri',[
 ['Tokyo 2020 kadınlar voleybol turnuvasının MVP’si kimdi?','Jordan Larson',['Paola Egonu','Tijana Bošković','Gabi Guimarães'],'ABD kaptanı Jordan Larson MVP seçildi.'],
 ['Tokyo 2020 kadınlar voleybolunda en iyi libero kim seçildi?','Justine Wong-Orantes',['Monica De Gennaro','Gizem Örge','Simge Aköz'],'En iyi libero ödülü Justine Wong-Orantes’a verildi.'],
 ['Tokyo 2020 kadınlar rüya takımının pasörü kimdi?','Jordyn Poulter',['Alessia Orro','Cansu Özbay','Maja Ognjenović'],'Jordyn Poulter en iyi pasör olarak rüya takıma seçildi.'],
 ['Tokyo 2020 kadınlar rüya takımına pasör çaprazı olarak kim seçildi?','Tijana Bošković',['Paola Egonu','Annie Drews','Rosamaria'],'Sırbistan’dan Tijana Bošković en iyi pasör çaprazı seçildi.'],
]);
qs('europe','EuroVolley 2023','https://www.fivb.com/magnificent-turkiye-seal-maiden-european-trophy-with-dramatic-comeback/','FIVB · EuroVolley 2023',[
 ['2023 kadınlar Avrupa şampiyonluğunu hangi ülke kazandı?','Türkiye',['Sırbistan','İtalya','Hollanda'],'Türkiye ilk Avrupa şampiyonluğunu 2023’te kazandı.'],
 ['Türkiye, 2023 kadınlar Avrupa finalinde hangi ülkeyi yendi?','Sırbistan',['İtalya','Polonya','Hollanda'],'Finalde Türkiye ile Sırbistan karşılaştı.'],
 ['2023 kadınlar Avrupa finalini Türkiye hangi skorla kazandı?','3-2',['3-0','3-1','2-3'],'Türkiye beş setlik finalde 3-2 galip geldi.'],
 ['2023 kadınlar Avrupa finalinde 41 sayı üreten MVP kimdi?','Melissa Vargas',['Ebrar Karakurt','Tijana Bošković','Paola Egonu'],'Vargas finalde 41 sayı üretti ve MVP ödülünü aldı.'],
]);
qs('europe','EuroVolley 2021','https://www.fivb.com/italy-back-on-top-of-eurovolley-podium-egonu-mvp/','FIVB · EuroVolley 2021',[
 ['2021 kadınlar Avrupa şampiyonu hangi ülkeydi?','İtalya',['Sırbistan','Türkiye','Hollanda'],'İtalya, 2021 Avrupa finalinde Sırbistan’ı yendi.'],
 ['2021 kadınlar Avrupa Şampiyonası finali hangi şehirde oynandı?','Belgrad',['Ankara','Brüksel','Roma'],'Final Sırbistan’ın başkenti Belgrad’da oynandı.'],
 ['2021 kadınlar Avrupa Şampiyonası’nın MVP’si kimdi?','Paola Egonu',['Tijana Bošković','Ebrar Karakurt','Myriam Sylla'],'Paola Egonu turnuvanın MVP’si seçildi.'],
 ['2021 kadınlar Avrupa Şampiyonası bronz madalyasını hangi ülke aldı?','Türkiye',['Hollanda','Polonya','Almanya'],'Türkiye üçüncülük maçında Hollanda’yı yenerek bronz aldı.'],
]);
qs('europe','EuroVolley 2019','https://www.cev.eu/articles/volleyball/serbia-silence-record-breaking-crowd-to-retain-eurovolley-crown/','CEV · EuroVolley 2019',[
 ['2019 kadınlar Avrupa Şampiyonası kupasını hangi ülke kazandı?','Sırbistan',['Türkiye','İtalya','Polonya'],'Sırbistan finalde ev sahibi Türkiye’yi yendi.'],
 ['2019 kadınlar Avrupa finali hangi şehirde oynandı?','Ankara',['İstanbul','Belgrad','Bükreş'],'2019 finali Ankara’da oynandı.'],
 ['Sırbistan, 2019 kadınlar Avrupa finalinde Türkiye’yi kaç kaç yendi?','3-2',['3-0','3-1','1-3'],'Final beş set sürdü ve Sırbistan 3-2 kazandı.'],
 ['2019 kadınlar Avrupa Şampiyonası’nda bronz madalyayı kim aldı?','İtalya',['Polonya','Hollanda','Almanya'],'İtalya üçüncülük maçında Polonya’yı yendi.'],
]);
qs('europe','CEV Şampiyonlar Ligi 2024',urls.santarelli,'CEV · 2024 kadınlar finali',[
 ['2024 kadınlar CEV Şampiyonlar Ligi şampiyonu hangi kulüptü?','Conegliano',['Milano','VakıfBank','Eczacıbaşı'],'Conegliano, 2024 Avrupa kulüpler finalini kazandı.'],
 ['Conegliano’nun 2024 kadınlar CEV Şampiyonlar Ligi finalindeki rakibi kimdi?','Milano',['Scandicci','VakıfBank','Fenerbahçe'],'Final iki İtalyan kulübü Conegliano ve Milano arasındaydı.'],
 ['2024 kadınlar CEV Şampiyonlar Ligi finali hangi skorla bitti?','Conegliano 3-2 Milano',['Conegliano 3-0 Milano','Milano 3-1 Conegliano','Milano 3-2 Conegliano'],'Conegliano, beş setlik finalde Milano’yu 3-2 yendi.'],
 ['2024 kadınlar CEV Şampiyonlar Ligi şampiyonu Conegliano’nun koçu kimdi?','Daniele Santarelli',['Giovanni Guidetti','Ferhat Akbaş','Julio Velasco'],'Conegliano şampiyonluğu Daniele Santarelli yönetiminde kazandı.'],
]);
qs('europe','CEV Şampiyonlar Ligi 2023','https://www.fivb.com/fivb-president-joins-european-volleyball-family-at-cev-super-finals/','FIVB · CEV 2023 finali',[
 ['2023 kadınlar CEV Şampiyonlar Ligi şampiyonu hangi Türk kulübüydü?','VakıfBank',['Eczacıbaşı','Fenerbahçe','Galatasaray'],'VakıfBank, Eczacıbaşı ile oynadığı finali kazandı.'],
 ['2023 kadınlar CEV Şampiyonlar Ligi finalinin iki takımı hangi ülkedendi?','Türkiye',['İtalya','Polonya','Fransa'],'Finalde iki Türk kulübü, VakıfBank ve Eczacıbaşı karşılaştı.'],
 ['2023 kadınlar CEV Şampiyonlar Ligi finalinin MVP’si kimdi?','Paola Egonu',['Tijana Bošković','Gabi Guimarães','Zehra Güneş'],'VakıfBank’ın pasör çaprazı Paola Egonu MVP seçildi.'],
 ['2023 CEV Süper Finalleri hangi İtalyan şehrinde düzenlendi?','Torino',['Milano','Roma','Bologna'],'2023 Süper Finalleri Torino’da oynandı.'],
]);
qs('world','Dünya Şampiyonası 2025','https://www.fivb.com/italy-continue-to-dominate-and-claim-the-world-title/','FIVB · 2025 dünya finali',[
 ['2025 kadınlar Dünya Şampiyonası’nı hangi ülke kazandı?','İtalya',['Türkiye','Brezilya','Japonya'],'İtalya, finalde Türkiye’yi yenerek dünya şampiyonu oldu.'],
 ['2025 kadınlar Dünya Şampiyonası’nda gümüş madalyayı hangi ülke aldı?','Türkiye',['Brezilya','Japonya','Sırbistan'],'Türkiye final oynayarak gümüş madalya kazandı.'],
 ['İtalya, 2025 kadınlar Dünya Şampiyonası finalini hangi skorla kazandı?','3-2',['3-0','3-1','1-3'],'İtalya ile Türkiye arasındaki final beş sette tamamlandı.'],
 ['2025 kadınlar Dünya Şampiyonası finali hangi şehirde oynandı?','Bangkok',['Tokyo','Roma','Ankara'],'Final Tayland’ın başkenti Bangkok’ta oynandı.'],
]);
qs('world','Dünya Şampiyonası 2025 ödülleri','https://www.fivb.com/orro-recognized-as-the-mvp-in-italys-second-world-championship-victory/','FIVB · 2025 dünya ödülleri',[
 ['2025 kadınlar Dünya Şampiyonası’nın MVP seçilen pasörü kimdi?','Alessia Orro',['Cansu Özbay','Jordyn Poulter','Nanami Seki'],'Alessia Orro hem MVP hem en iyi pasör ödülünü aldı.'],
 ['2025 kadınlar Dünya Şampiyonası rüya takımının pasör çaprazı kimdi?','Melissa Vargas',['Paola Egonu','Tijana Bošković','Gong Xiangyu'],'Melissa Vargas en iyi pasör çaprazı seçildi.'],
 ['2025 kadınlar Dünya Şampiyonası rüya takımına giren Türk orta oyuncu kimdi?','Eda Erdem',['Zehra Güneş','Aslı Kalaç','Beyza Arıcı'],'Türkiye kaptanı Eda Erdem rüya takıma seçildi.'],
 ['2025 kadınlar Dünya Şampiyonası rüya takımındaki Japon smaçör kimdi?','Mayu Ishikawa',['Yoshino Sato','Ai Kurogo','Yukiko Wada'],'Mayu Ishikawa iki en iyi smaçörden biri seçildi.'],
]);
qs('world','Dünya Şampiyonası 2022','https://en.volleyballworld.com/news/serbia-sweep-brazil-and-retain-world-title','Volleyball World · 2022 dünya finali',[
 ['2022 kadınlar Dünya Şampiyonası’nı hangi ülke kazandı?','Sırbistan',['Brezilya','İtalya','ABD'],'Sırbistan 2022’de dünya şampiyonluğunu korudu.'],
 ['Sırbistan’ın 2022 kadınlar dünya finalindeki rakibi kimdi?','Brezilya',['İtalya','ABD','Türkiye'],'Finalde Sırbistan ile Brezilya karşılaştı.'],
 ['Sırbistan, 2022 kadınlar dünya finalini hangi skorla kazandı?','3-0',['3-1','3-2','2-3'],'Sırbistan finalde Brezilya’ya set vermedi.'],
 ['Şampiyon Sırbistan, 2022 kadınlar Dünya Şampiyonası boyunca kaç maç kaybetti?','0',['1','2','3'],'Sırbistan turnuvayı 12 maçta 12 galibiyetle bitirdi.'],
]);
qs('world','Dünya Şampiyonası 2018','https://en.volleyballworld.com/volleyball/competitions/women-world-championship/2022/news/2018-review-serbia-celebrate-first-world-championship-gold','Volleyball World · 2018 dünya özeti',[
 ['2018’de ilk kadınlar dünya şampiyonluğunu kazanan ülke hangisiydi?','Sırbistan',['İtalya','Çin','Brezilya'],'Sırbistan ilk dünya şampiyonluğunu 2018’de kazandı.'],
 ['2018 kadınlar Dünya Şampiyonası’na hangi ülke ev sahipliği yaptı?','Japonya',['Çin','Tayland','Hollanda'],'2018 turnuvası Japonya’da düzenlendi.'],
 ['2018 kadınlar dünya finalinde Sırbistan hangi ülkeyi yendi?','İtalya',['Çin','ABD','Brezilya'],'Sırbistan, İtalya’yı 3-2 yenerek şampiyon oldu.'],
 ['2018 kadınlar Dünya Şampiyonası bronz madalyasını hangi ülke aldı?','Çin',['Hollanda','Japonya','ABD'],'Çin, üçüncülük maçında Hollanda’yı yenerek bronz kazandı.'],
]);
qs('world','Dünya Şampiyonası 2022 bronz maçı','https://en.volleyballworld.com/news/italy-shut-out-usa-for-bronze','Volleyball World · 2022 bronz maçı',[
 ['2022 kadınlar Dünya Şampiyonası bronz madalyasını hangi ülke kazandı?','İtalya',['ABD','Türkiye','Japonya'],'İtalya üçüncülük maçında ABD’yi yendi.'],
 ['İtalya, 2022 kadınlar dünya bronz maçında hangi ülkeyi yendi?','ABD',['Brezilya','Çin','Türkiye'],'İtalya ile ABD bronz madalya için karşılaştı.'],
 ['2022 kadınlar dünya bronz maçını İtalya hangi skorla kazandı?','3-0',['3-1','3-2','2-3'],'İtalya, ABD karşısında 3-0 galip geldi.'],
 ['İtalya’nın 2022 dünya bronz maçında 25 sayı üreten oyuncusu kimdi?','Paola Egonu',['Myriam Sylla','Anna Danesi','Alessia Orro'],'Paola Egonu 25 sayıyla galibiyete katkı verdi.'],
]);
if(players.length!==100 || coaches.length!==10 || questions.length!==100) throw new Error(`Counts: ${players.length}/${coaches.length}/${questions.length}`);
const content={...legacy,schema:4,revision:5,publishedAt:'2026-10-23T17:08:03.000Z',roster:{version:'world-20261023-v2',asOf:checkedAt,budget:65,players,coaches},quiz:{id:'international-100-v1',revision:1,roundSize:10,questions}};
// Expiry and rights are not silently renewed by rebuilding the authored catalogue.
writeFileSync(new URL('../public/content.json',import.meta.url),JSON.stringify(content,null,2)+'\n');
const manifest={checkedAt,scope:'Local development of an international budget game. No live feed, prices copied from VNL, new club marks or photos. Editorial game costs, not official ratings.',
 rosterBasis:'Existing 14 identities retain 2026–27 league references. Added identities use explicitly labelled 2025 national-team call-ups/World Championship rosters; not a current squad claim.',
 costModel:{version:content.roster.version,budget:65,playerBands:[3,5,7,9,12],coachBands:[2,3,4,5,6],method:'Independent within-position editorial tiers (development/depth, established, international regular, elite, premium); costs then tested for feasible diverse lineups. Not a mathematical cross-position performance score.',vnlPriceStatus:'No public current player or coach fantasy-price table verified. No VNL fantasy values imported.',reviewStatus:'Initial editorial calibration, subject to user playtest; not a verified ranking.'},
 players:players.map(p=>({id:p.id,name:p.name,cost:p.cost,role:p.role,country:p.countryCode,source:p.sourceUrl,basis:p.sourceLabel})),coaches,
 questions:questions.map(q=>({id:q.id,category:q.category,event:q.season,source:q.source.url,checkedAt:q.source.checkedAt})),
 flags:['br','jp','it','rs','pl','us','cn'].map(code=>({file:`public/marks/countries/${code}.svg`,url:`https://raw.githubusercontent.com/lipis/flag-icons/v7.5.0/flags/4x3/${code}.svg`,license:'MIT; adjacent LICENSE.txt',sha256:createHash('sha256').update(readFileSync(new URL(`../public/marks/countries/${code}.svg`,import.meta.url))).digest('hex')})),
 exclusions:['No disputed set-by-set 2025 world final score included. TVF and FIVB disagree on the tie-break score; overall 3-2 agrees.','Brazil name aliases follow official call-up naming; no current club inferred.','Japan Wada/Nonaka roles follow the dated English 2025 national-team call-up (opposite), not a claim about every competition registration.','Old 2026 league event/date caveats remain in the previous provenance manifest.']};
writeFileSync(new URL('../docs/international-content-provenance.json',import.meta.url),JSON.stringify(manifest,null,2)+'\n');
console.log(`Authored ${players.length} players, ${coaches.length} coaches, ${questions.length} questions. Expiry unchanged: ${content.validUntil}`);
