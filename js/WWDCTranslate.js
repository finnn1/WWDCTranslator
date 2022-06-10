console.log("WWDC 한글 자막 확장프로그램 실행됨.")

window.onload = function () {
  console.log("도큐먼트 로드됨.")

  const korParagraph = document.createElement('p');
  const korDiv = document.createElement('div');
  korDiv.id = 'TranslateDiv'
  const korText = document.createTextNode('불러오는 중...');

  const engParagraph = document.createElement('p');
  const engDiv = document.createElement('div');
  engDiv.id = 'TranslateDivEng'
  const engText = document.createTextNode('wait for load...');

  // 비디오 재생 시간이 변경되면 원하는 함수 실행하기
  const aud = document.getElementById('video');

  // 자막 div 만들기
  if (document.getElementById('TranslateDiv') == null) {
    aud.after(korParagraph)

    korParagraph.appendChild(korDiv)
    korDiv.appendChild(korText)

    engParagraph.appendChild(engDiv)
    engDiv.appendChild(engText)

    korParagraph.after(engParagraph)
  }

  // ##### 문자열을 문장 단위로 합치기 #####
  // 모든 p를 얻어옴 (시간과 함께 나누어져 있는 문장들)
  var paragraphs = document.querySelector('.supplement.transcript[data-supplement-id="transcript"]').querySelectorAll('p')

  var seperatedSentences
  var sentencesList = []

  // p 개수 만큼 반복
  for (pIndex = 0; pIndex < paragraphs.length; pIndex++) {
    seperatedSentences = paragraphs[pIndex].querySelectorAll('.sentence')

    // 문장 변수
    var word = ""
    var currentTime = 0
    for (sIndex = 0; sIndex < seperatedSentences.length; sIndex++) {
      var sentenceText = seperatedSentences[sIndex].textContent.trim()

      // word가 비어있다면 -> 첫번째 문장의 시간을 저장해놓기
      if (word == "") {
        currentTime = seperatedSentences[sIndex].href.split('=').pop()
      }

      // .으로 끝난다면
      var dotIndex = sentenceText.indexOf('.')
      var sentenceLength = sentenceText.length

      if (dotIndex == (sentenceLength - 1) && dotIndex > 0) {
        word += " " + sentenceText
        sentencesList.push([currentTime, word])
        word = ""
      } else {
        word += " " + sentenceText
      }
    }
  }

  // ##### 비디오가 재생되면 지속적으로 업데이트 #####
  // console.log(aud.currentTime)
  aud.ontimeupdate = function () {

    // 원본 영문 자막 가져오기
    const transcript = Array.from(document.querySelector('.supplement.transcript[data-supplement-id="transcript"]').querySelectorAll('p'))


    // 현재 시간과 가장 가까운 p 찾기
    var paragraphTimes = sentencesList.map((number, index) => {
      return [index, number[0] - (aud.currentTime - 0.05)]
    })

    // 음수는 버리기
    var filteredTimes = paragraphTimes.filter(number => number[1] >= 0)

    // 가장 빠른 인덱스 구하기 (현재 재생시간과 가장 가까운 자막의 인덱스)
    var earlierIndex = filteredTimes[0][0] - 1
    if (earlierIndex < 0) {
      earlierIndex = 0
    }

    // 영어 자막을 시간에 맞게 설정하기
    if (document.getElementById('TranslateDivEng').textContent != sentencesList[earlierIndex][1]) {
      document.getElementById('TranslateDivEng').textContent = sentencesList[earlierIndex][1]
      document.getElementById('TranslateDiv').textContent = document.getElementById('TranslateDivEng').textContent
      console.log(sentencesList[earlierIndex][1])
    }

    // ##### 한국어로 번역 #####
    if (document.getElementById('TranslateDiv').innerText == document.getElementById('TranslateDivEng').innerText) {
      let transText = document.getElementById('TranslateDivEng').textContent

      // XMLHttpRequest 파싱
      var xhr = new XMLHttpRequest();
      xhr.open("POST", "https://translation.googleapis.com/language/translate/v2?key=" + apiKey, true);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.send(JSON.stringify({
        q: transText,
        target: "ko",
        source: "en"
      }));

      xhr.onreadystatechange = function () {
        if (this.readyState != 4) return;
        if (this.status == 200) {

          // 데이터 받아옴
          receivedData = JSON.parse(this.responseText);
        }

        // 데이터가 받아온 다음에 실행되는 곳 (비동기식)
        let translatedText = receivedData.data.translations[0].translatedText
        console.log("번역됨: " + translatedText)

        // 번역한 문장 업데이트
        document.getElementById('TranslateDiv').innerText = translatedText
      }
    }
  }
}