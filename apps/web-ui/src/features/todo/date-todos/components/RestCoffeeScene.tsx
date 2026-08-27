type RestCoffeeSceneProps = {
  restMinutes: number;
};

function RestCoffeeIllustration() {
  return (
    <div className="rest-coffee-scene__visual" aria-hidden="true">
      <svg
        className="rest-coffee-scene__illustration"
        viewBox="0 0 220 190"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <ellipse cx="110" cy="163" rx="64" ry="10" fill="currentColor" opacity="0.09" />

        <g className="rest-coffee-scene__machine">
          <rect x="51" y="25" width="118" height="126" rx="18" fill="#EEF2E7" stroke="#242424" strokeWidth="4" />
          <path d="M61 25H159L164 36H56L61 25Z" fill="#DCE7D2" stroke="#242424" strokeWidth="4" strokeLinejoin="round" />
          <rect x="66" y="43" width="88" height="31" rx="8" fill="#FFFDF9" stroke="#242424" strokeWidth="4" />
          <circle cx="78" cy="58.5" r="4.5" fill="#F45B43" />
          <path d="M91 54H140M91 63H126" stroke="#7C8176" strokeWidth="3" strokeLinecap="round" />
          <path d="M66 83H154V140C154 146.075 149.075 151 143 151H77C70.9249 151 66 146.075 66 140V83Z" fill="#FFFDF9" stroke="#242424" strokeWidth="4" />
          <path d="M91 89H129V99H121V107H99V99H91V89Z" fill="#CCD5C4" stroke="#242424" strokeWidth="4" strokeLinejoin="round" />
          <path d="M110 107V126" className="rest-coffee-scene__pour" />

          <g className="rest-coffee-scene__cup-group">
            <path d="M84 123H136L132 148C131.224 152.851 127.038 156.42 122.126 156.42H97.8739C92.9621 156.42 88.7759 152.851 88 148L84 123Z" fill="#F4684F" stroke="#242424" strokeWidth="4" strokeLinejoin="round" />
            <path d="M136 130H143C149.075 130 154 134.925 154 141C154 147.075 149.075 152 143 152H132" stroke="#242424" strokeWidth="4" strokeLinecap="round" />
            <path d="M87 123H133" className="rest-coffee-scene__coffee-line" />
            <path d="M98 140H122" stroke="#FFD4C8" strokeWidth="4" strokeLinecap="round" opacity="0.8" />
          </g>
        </g>

        <g className="rest-coffee-scene__steam-lines">
          <path d="M94 119C88 111 99 106 94 97" />
          <path d="M126 119C132 111 121 106 126 97" />
        </g>

        <path
          className="rest-coffee-scene__sparkle rest-coffee-scene__sparkle--large"
          d="M181 42C181 50 176 55 168 55C176 55 181 60 181 68C181 60 186 55 194 55C186 55 181 50 181 42Z"
          fill="#F45B43"
        />
        <circle className="rest-coffee-scene__sparkle rest-coffee-scene__sparkle--small" cx="42" cy="53" r="5" fill="#F45B43" />
      </svg>
    </div>
  );
}

export function RestCoffeeScene({ restMinutes }: RestCoffeeSceneProps) {
  return (
    <div className="rest-coffee-scene">
      <RestCoffeeIllustration />
      <div className="rest-coffee-scene__copy">
        <p className="rest-coffee-scene__title">커피 한 잔 내리는 중이에요</p>
        <p className="rest-coffee-scene__description">
          잠시 쉬어가며 다음 집중을 천천히 준비해요.
        </p>
        <p className="rest-coffee-scene__time">누적 휴식 {restMinutes}분</p>
      </div>
    </div>
  );
}
