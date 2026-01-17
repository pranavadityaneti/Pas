import svgPaths from "./svg-pyrnda9ik8";

function ImagePlaceholder() {
  return (
    <div className="h-[108.71px] relative shrink-0 w-[374.19px]" data-name="Image placeholder">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 374.19 108.71">
        <g id="Image placeholder">
          <rect fill="var(--fill-0, white)" height="108.71" rx="18.31" width="374.19" />
          <g id="Icons">
            <path d={svgPaths.p9922b80} id="Vector" stroke="var(--stroke-0, #667080)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
            <path d={svgPaths.p37f7d580} id="Vector_2" stroke="var(--stroke-0, #667080)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
            <path d="M196 56L191 51L180 62" id="Vector_3" stroke="var(--stroke-0, #667080)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
          </g>
        </g>
      </svg>
    </div>
  );
}

function StoreImg() {
  return (
    <div className="content-stretch flex flex-col gap-[5px] items-start relative shrink-0" data-name="store_img">
      <ImagePlaceholder />
      <p className="css-ew64yg font-['Mulish:Light',sans-serif] font-light leading-[30px] relative shrink-0 text-[16px] text-black">Lorem ipsum dolor sit amet, consectetur adipiscin</p>
    </div>
  );
}

function StoreCard() {
  return (
    <div className="content-stretch flex gap-[13px] items-start relative shrink-0" data-name="store_card">
      {[...Array(2).keys()].map((_, i) => (
        <StoreImg key={i} />
      ))}
    </div>
  );
}

function Stores() {
  return (
    <div className="absolute content-stretch flex flex-col gap-[5px] items-start left-[24px] top-[1178.13px]" data-name="stores">
      <p className="css-ew64yg font-['Mulish:Bold',sans-serif] font-bold leading-[50px] relative shrink-0 text-[#262525] text-[20px]">{`Dining & Restaurants`}</p>
      <StoreCard />
    </div>
  );
}

function ImagePlaceholder1() {
  return (
    <div className="absolute h-[353.59px] left-0 top-0 w-[302.1px]" data-name="Image placeholder">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 302.1 353.59">
        <g id="Image placeholder">
          <rect fill="var(--fill-0, white)" height="353.59" rx="18.31" width="302.1" />
          <g id="Icons">
            <path d={svgPaths.p23557480} id="Vector" stroke="var(--stroke-0, #667080)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
            <path d={svgPaths.p1b10c900} id="Vector_2" stroke="var(--stroke-0, #667080)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
            <path d="M160 179L155 174L144 185" id="Vector_3" stroke="var(--stroke-0, #667080)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
          </g>
        </g>
      </svg>
    </div>
  );
}

function ArrivalText() {
  return (
    <div className="absolute content-stretch flex flex-col gap-[16px] items-start leading-[normal] left-[22.89px] text-[18px] top-[264.41px] uppercase" data-name="arrival_text">
      <p className="css-ew64yg font-['Roboto:Medium',sans-serif] font-medium relative shrink-0 text-[#262525]" style={{ fontVariationSettings: "'wdth' 100" }}>
        Lorem ipsum dolor
      </p>
      <p className="css-ew64yg font-['Roboto:Black',sans-serif] font-black relative shrink-0 text-[#667080]" style={{ fontVariationSettings: "'wdth' 100" }}>
        ₹15.18
      </p>
    </div>
  );
}

function FavIcon() {
  return (
    <div className="absolute left-[244.88px] size-[38.906px] top-[18.39px]" data-name="fav_icon">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 38.9064 38.9064">
        <g id="fav_icon">
          <circle cx="19.4532" cy="19.4532" fill="var(--fill-0, #667080)" id="Ellipse" r="19.4532" />
          <g id="icon">
            <path d={svgPaths.p2b27c6c0} fill="var(--fill-0, white)" id="shape" />
          </g>
        </g>
      </svg>
    </div>
  );
}

function ArrvialImg() {
  return (
    <div className="h-[353.591px] relative shrink-0 w-[302.1px]" data-name="arrvial_img">
      <ImagePlaceholder1 />
      <div className="absolute bg-[rgba(255,255,255,0.4)] h-[353.591px] left-0 rounded-[18.309px] top-0 w-[302.097px]" data-name="arrival card" />
      <ArrivalText />
      <FavIcon />
    </div>
  );
}

function ArrvialCard() {
  return (
    <div className="content-stretch flex gap-[27px] items-start relative shrink-0" data-name="arrvial_card">
      {[...Array(2).keys()].map((_, i) => (
        <ArrvialImg key={i} />
      ))}
    </div>
  );
}

function Arrival() {
  return (
    <div className="absolute content-stretch flex flex-col items-start left-[24px] top-[758.73px]" data-name="arrival">
      <p className="css-ew64yg font-['Mulish:Bold',sans-serif] font-bold leading-[50px] relative shrink-0 text-[#262525] text-[20px]">New Arrivals</p>
      <ArrvialCard />
    </div>
  );
}

function ImagePlaceholder2() {
  return (
    <div className="absolute h-[157.91px] left-[420px] top-[125px] w-[383.34px]" data-name="Image placeholder">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 383.34 157.91">
        <g data-figma-bg-blur-radius="40" id="Image placeholder">
          <rect fill="var(--fill-0, #EEF1F4)" height="157.91" rx="18.31" width="383.34" />
          <g id="Icons">
            <path d={svgPaths.p1380a300} id="Vector" stroke="var(--stroke-0, #667080)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
            <path d={svgPaths.p36f63f0} id="Vector_2" stroke="var(--stroke-0, #667080)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
            <path d="M201 81L196 76L185 87" id="Vector_3" stroke="var(--stroke-0, #667080)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
          </g>
        </g>
        <defs>
          <clipPath id="bgblur_0_1_354_clip_path" transform="translate(40 40)">
            <rect height="157.91" rx="18.31" width="383.34" />
          </clipPath>
        </defs>
      </svg>
    </div>
  );
}

function ImagePlaceholder3() {
  return (
    <div className="absolute h-[157.91px] left-[816.34px] top-[125px] w-[383.34px]" data-name="Image placeholder">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 383.34 157.91">
        <g data-figma-bg-blur-radius="40" id="Image placeholder">
          <rect fill="var(--fill-0, #EEF1F4)" height="157.91" rx="18.31" width="383.34" />
          <g id="Icons">
            <path d={svgPaths.p1380a300} id="Vector" stroke="var(--stroke-0, #667080)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
            <path d={svgPaths.p36f63f0} id="Vector_2" stroke="var(--stroke-0, #667080)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
            <path d="M201 81L196 76L185 87" id="Vector_3" stroke="var(--stroke-0, #667080)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
          </g>
        </g>
        <defs>
          <clipPath id="bgblur_0_1_354_clip_path" transform="translate(40 40)">
            <rect height="157.91" rx="18.31" width="383.34" />
          </clipPath>
        </defs>
      </svg>
    </div>
  );
}

function SideNav() {
  return (
    <div className="grid-cols-[max-content] grid-rows-[max-content] inline-grid items-[start] justify-items-[start] leading-[0] relative shrink-0" data-name="side_nav">
      <div className="bg-[#667080] col-1 h-[3.167px] ml-0 mt-0 rounded-[33px] row-1 w-[26.917px]" data-name="Rectangle03" />
      <div className="bg-[#667080] col-1 h-[3.167px] ml-0 mt-[10.17px] rounded-[33px] row-1 w-[26.917px]" data-name="Rectangle02" />
      <div className="bg-[#667080] col-1 h-[3.167px] ml-0 mt-[20.33px] rounded-[33px] row-1 w-[16.889px]" data-name="Rectangle01" />
    </div>
  );
}

function Account() {
  return (
    <div className="relative shrink-0 size-[35px]" data-name="Account">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 35 35">
        <g clipPath="url(#clip0_1_350)" id="Account">
          <path d={svgPaths.p3879700} fill="var(--fill-0, #667080)" id="Vector" />
          <g id="Vector_2"></g>
        </g>
        <defs>
          <clipPath id="clip0_1_350">
            <rect fill="white" height="35" width="35" />
          </clipPath>
        </defs>
      </svg>
    </div>
  );
}

function TopNav() {
  return (
    <div className="absolute content-stretch flex items-center justify-between left-0 overflow-clip px-[24px] py-0 top-[66px] w-[428px]" data-name="top_nav">
      <SideNav />
      <Account />
    </div>
  );
}

function Home() {
  return (
    <div className="relative shrink-0 size-[25px]" data-name="home">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 25 25">
        <g clipPath="url(#clip0_1_346)" id="home">
          <path d={svgPaths.p1725c400} fill="var(--fill-0, #667080)" id="Vector" />
          <g id="Vector_2"></g>
        </g>
        <defs>
          <clipPath id="clip0_1_346">
            <rect fill="white" height="25" width="25" />
          </clipPath>
        </defs>
      </svg>
    </div>
  );
}

function Catalog() {
  return (
    <div className="relative shrink-0 size-[25px]" data-name="catalog">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 25 25">
        <g id="catalog">
          <path d={svgPaths.p20b1c880} fill="var(--fill-0, #EEF1F4)" id="Vector" />
          <path d={svgPaths.p198cdc40} fill="var(--fill-0, #EEF1F4)" id="Vector_2" />
          <path d={svgPaths.p23dc3f00} fill="var(--fill-0, #EEF1F4)" id="Vector_3" />
          <path d={svgPaths.p2ef5ef80} fill="var(--fill-0, #EEF1F4)" id="Vector_4" />
        </g>
      </svg>
    </div>
  );
}

function Favorite() {
  return (
    <div className="relative shrink-0 size-[25px]" data-name="favorite">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 25 25">
        <g clipPath="url(#clip0_1_402)" id="favorite">
          <g id="Vector"></g>
          <path d={svgPaths.pa976600} fill="var(--fill-0, #EEF1F4)" id="Vector_2" />
        </g>
        <defs>
          <clipPath id="clip0_1_402">
            <rect fill="white" height="25" width="25" />
          </clipPath>
        </defs>
      </svg>
    </div>
  );
}

function ShoppingCart() {
  return (
    <div className="relative shrink-0 size-[25px]" data-name="shopping_cart">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 25 25">
        <g clipPath="url(#clip0_1_393)" id="shopping_cart">
          <path d={svgPaths.p14584500} fill="var(--fill-0, #EEF1F4)" id="Vector" />
          <g id="Vector_2"></g>
        </g>
        <defs>
          <clipPath id="clip0_1_393">
            <rect fill="white" height="25" width="25" />
          </clipPath>
        </defs>
      </svg>
    </div>
  );
}

function Icons() {
  return (
    <div className="bg-white content-stretch flex items-center justify-between overflow-clip px-[32px] py-0 relative shrink-0 w-[376px]" data-name="Icons">
      <Home />
      <Catalog />
      <Favorite />
      <ShoppingCart />
    </div>
  );
}

function Slider() {
  return (
    <div className="bg-white h-[2px] overflow-clip relative shrink-0 w-[376px]" data-name="Slider">
      <div className="absolute bg-[#667080] h-[2px] left-[40px] rounded-[100px] top-0 w-[16px]" data-name="Slider" />
    </div>
  );
}

function Nav() {
  return (
    <div className="absolute bg-white content-stretch flex flex-col gap-[10px] h-[93px] items-center justify-center left-0 px-0 py-[20px] rounded-[50px] top-[1393px] w-[428px]" data-name="nav">
      <Icons />
      <Slider />
    </div>
  );
}

function EditorChoice() {
  return (
    <div className="relative shrink-0 size-[22.314px]" data-name="editor_choice">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 22.3138 22.3138">
        <g id="editor_choice">
          <mask height="23" id="mask0_1_342" maskUnits="userSpaceOnUse" style={{ maskType: "alpha" }} width="23" x="0" y="0">
            <rect fill="var(--fill-0, #D9D9D9)" height="22.3138" id="Bounding box" width="22.3138" />
          </mask>
          <g mask="url(#mask0_1_342)">
            <path d={svgPaths.p39df8f00} fill="var(--fill-0, #EEF1F4)" id="editor_choice_2" />
          </g>
        </g>
      </svg>
    </div>
  );
}

function Group() {
  return (
    <div className="bg-[rgba(128,128,128,0.55)] content-stretch flex items-center overflow-clip p-[18.595px] relative rounded-[29.752px] shrink-0">
      <EditorChoice />
    </div>
  );
}

function Tab() {
  return (
    <div className="content-stretch flex flex-col gap-[7.438px] items-center px-[3.719px] py-0 relative shrink-0" data-name="Tab 1">
      <Group />
      <p className="css-4hzbpn font-['SF_Compact_Display:Semibold',sans-serif] leading-[normal] not-italic relative shrink-0 text-[#1c1b1f] text-[12.087px] text-center tracking-[0.1859px] w-[65.082px]">Acclaimed</p>
    </div>
  );
}

function Nutrition() {
  return (
    <div className="relative shrink-0 size-[22.314px]" data-name="nutrition">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 22.3138 22.3138">
        <g id="nutrition">
          <mask height="23" id="mask0_1_334" maskUnits="userSpaceOnUse" style={{ maskType: "alpha" }} width="23" x="0" y="0">
            <rect fill="var(--fill-0, #D9D9D9)" height="22.3138" id="Bounding box" width="22.3138" />
          </mask>
          <g mask="url(#mask0_1_334)">
            <path d={svgPaths.p2eda9730} fill="var(--fill-0, #EEF1F4)" id="nutrition_2" />
          </g>
        </g>
      </svg>
    </div>
  );
}

function Frame() {
  return (
    <div className="bg-[rgba(128,128,128,0.55)] content-stretch flex items-center p-[18.595px] relative rounded-[29.752px] shrink-0">
      <Nutrition />
    </div>
  );
}

function Tab4() {
  return (
    <div className="content-stretch flex flex-col gap-[7.438px] items-center px-[3.719px] py-0 relative shrink-0" data-name="Tab 5">
      <Frame />
      <p className="css-4hzbpn font-['SF_Compact_Display:Semibold',sans-serif] leading-[normal] not-italic relative shrink-0 text-[#1c1b1f] text-[12.087px] text-center tracking-[0.1859px] w-[65.082px]">Healthy</p>
    </div>
  );
}

function LocalPizza() {
  return (
    <div className="relative shrink-0 size-[22.314px]" data-name="local_pizza">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 22.3138 22.3138">
        <g id="local_pizza">
          <mask height="23" id="mask0_1_330" maskUnits="userSpaceOnUse" style={{ maskType: "alpha" }} width="23" x="0" y="0">
            <rect fill="var(--fill-0, #D9D9D9)" height="22.3138" id="Bounding box" width="22.3138" />
          </mask>
          <g mask="url(#mask0_1_330)">
            <path d={svgPaths.p154d3300} fill="var(--fill-0, #EEF1F4)" id="local_pizza_2" />
          </g>
        </g>
      </svg>
    </div>
  );
}

function Group1() {
  return (
    <div className="bg-[rgba(128,128,128,0.55)] content-stretch flex items-center overflow-clip p-[18.595px] relative rounded-[29.752px] shrink-0">
      <LocalPizza />
    </div>
  );
}

function Tab1() {
  return (
    <div className="content-stretch flex flex-col gap-[7.438px] items-center px-[3.719px] py-0 relative shrink-0" data-name="Tab 2">
      <Group1 />
      <p className="css-4hzbpn font-['SF_Compact_Display:Semibold',sans-serif] leading-[normal] not-italic relative shrink-0 text-[#1c1b1f] text-[12.087px] text-center tracking-[0.1859px] w-[65.082px]">Pizza</p>
    </div>
  );
}

function RamenDining() {
  return (
    <div className="relative shrink-0 size-[22.314px]" data-name="ramen_dining">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 22.3138 22.3138">
        <g id="ramen_dining">
          <mask height="23" id="mask0_1_383" maskUnits="userSpaceOnUse" style={{ maskType: "alpha" }} width="23" x="0" y="0">
            <rect fill="var(--fill-0, #D9D9D9)" height="22.3138" id="Bounding box" width="22.3138" />
          </mask>
          <g mask="url(#mask0_1_383)">
            <path d={svgPaths.p1a76ca80} fill="var(--fill-0, #EEF1F4)" id="ramen_dining_2" />
          </g>
        </g>
      </svg>
    </div>
  );
}

function Group2() {
  return (
    <div className="bg-[rgba(128,128,128,0.55)] content-stretch flex items-center overflow-clip p-[18.595px] relative rounded-[29.752px] shrink-0">
      <RamenDining />
    </div>
  );
}

function Tab3() {
  return (
    <div className="content-stretch flex flex-col gap-[7.438px] items-center px-[3.719px] py-0 relative shrink-0" data-name="Tab 4">
      <Group2 />
      <p className="css-ew64yg font-['SF_Compact_Display:Semibold',sans-serif] leading-[normal] not-italic relative shrink-0 text-[#1c1b1f] text-[12.087px] text-center tracking-[0.1859px]">Ramen</p>
    </div>
  );
}

function Fastfood() {
  return (
    <div className="relative shrink-0 size-[22.314px]" data-name="fastfood">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 22.3138 22.3138">
        <g id="fastfood">
          <mask height="23" id="mask0_1_338" maskUnits="userSpaceOnUse" style={{ maskType: "alpha" }} width="23" x="0" y="0">
            <rect fill="var(--fill-0, #D9D9D9)" height="22.3138" id="Bounding box" width="22.3138" />
          </mask>
          <g mask="url(#mask0_1_338)">
            <path d={svgPaths.p2ce1ca80} fill="var(--fill-0, #EEF1F4)" id="fastfood_2" />
          </g>
        </g>
      </svg>
    </div>
  );
}

function Frame1() {
  return (
    <div className="bg-[rgba(128,128,128,0.55)] content-stretch flex items-center p-[18.595px] relative rounded-[29.752px] shrink-0">
      <Fastfood />
    </div>
  );
}

function Tab5() {
  return (
    <div className="content-stretch flex flex-col gap-[7.438px] items-center px-[3.719px] py-0 relative shrink-0" data-name="Tab 6">
      <Frame1 />
      <p className="css-4hzbpn font-['SF_Compact_Display:Semibold',sans-serif] leading-[normal] not-italic relative shrink-0 text-[#1c1b1f] text-[12.087px] text-center tracking-[0.1859px] w-[65.082px]">Burger</p>
    </div>
  );
}

function TabBarButtons() {
  return (
    <div className="content-stretch flex gap-[3.719px] items-start px-[14.876px] py-0 relative shrink-0" data-name="Tab Bar Buttons">
      <Tab />
      <Tab4 />
      <Tab1 />
      <Tab3 />
      <Tab5 />
    </div>
  );
}

function ViewCategoriesNavigationBar() {
  return (
    <div className="absolute content-stretch flex flex-col h-[111.569px] items-start justify-between left-[14px] px-0 py-[14.876px] top-[532px] w-[397px]" data-name="View / Categories Navigation Bar">
      <TabBarButtons />
    </div>
  );
}

function EditorChoice1() {
  return (
    <div className="relative shrink-0 size-[22.314px]" data-name="editor_choice">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 22.3138 22.3138">
        <g id="editor_choice">
          <mask height="23" id="mask0_1_342" maskUnits="userSpaceOnUse" style={{ maskType: "alpha" }} width="23" x="0" y="0">
            <rect fill="var(--fill-0, #D9D9D9)" height="22.3138" id="Bounding box" width="22.3138" />
          </mask>
          <g mask="url(#mask0_1_342)">
            <path d={svgPaths.p39df8f00} fill="var(--fill-0, #EEF1F4)" id="editor_choice_2" />
          </g>
        </g>
      </svg>
    </div>
  );
}

function Group6() {
  return (
    <div className="bg-[rgba(128,128,128,0.55)] content-stretch flex items-center overflow-clip p-[18.595px] relative rounded-[29.752px] shrink-0">
      <EditorChoice1 />
    </div>
  );
}

function Tab2() {
  return (
    <div className="content-stretch flex flex-col gap-[7.438px] items-center px-[3.719px] py-0 relative shrink-0" data-name="Tab 1">
      <Group6 />
      <p className="css-4hzbpn font-['SF_Compact_Display:Semibold',sans-serif] leading-[normal] not-italic relative shrink-0 text-[#1c1b1f] text-[12.087px] text-center tracking-[0.1859px] w-[65.082px]">Acclaimed</p>
    </div>
  );
}

function Nutrition1() {
  return (
    <div className="relative shrink-0 size-[22.314px]" data-name="nutrition">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 22.3138 22.3138">
        <g id="nutrition">
          <mask height="23" id="mask0_1_334" maskUnits="userSpaceOnUse" style={{ maskType: "alpha" }} width="23" x="0" y="0">
            <rect fill="var(--fill-0, #D9D9D9)" height="22.3138" id="Bounding box" width="22.3138" />
          </mask>
          <g mask="url(#mask0_1_334)">
            <path d={svgPaths.p2eda9730} fill="var(--fill-0, #EEF1F4)" id="nutrition_2" />
          </g>
        </g>
      </svg>
    </div>
  );
}

function Frame2() {
  return (
    <div className="bg-[rgba(128,128,128,0.55)] content-stretch flex items-center p-[18.595px] relative rounded-[29.752px] shrink-0">
      <Nutrition1 />
    </div>
  );
}

function Tab6() {
  return (
    <div className="content-stretch flex flex-col gap-[7.438px] items-center px-[3.719px] py-0 relative shrink-0" data-name="Tab 5">
      <Frame2 />
      <p className="css-4hzbpn font-['SF_Compact_Display:Semibold',sans-serif] leading-[normal] not-italic relative shrink-0 text-[#1c1b1f] text-[12.087px] text-center tracking-[0.1859px] w-[65.082px]">Healthy</p>
    </div>
  );
}

function LocalPizza1() {
  return (
    <div className="relative shrink-0 size-[22.314px]" data-name="local_pizza">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 22.3138 22.3138">
        <g id="local_pizza">
          <mask height="23" id="mask0_1_330" maskUnits="userSpaceOnUse" style={{ maskType: "alpha" }} width="23" x="0" y="0">
            <rect fill="var(--fill-0, #D9D9D9)" height="22.3138" id="Bounding box" width="22.3138" />
          </mask>
          <g mask="url(#mask0_1_330)">
            <path d={svgPaths.p154d3300} fill="var(--fill-0, #EEF1F4)" id="local_pizza_2" />
          </g>
        </g>
      </svg>
    </div>
  );
}

function Group7() {
  return (
    <div className="bg-[rgba(128,128,128,0.55)] content-stretch flex items-center overflow-clip p-[18.595px] relative rounded-[29.752px] shrink-0">
      <LocalPizza1 />
    </div>
  );
}

function Tab7() {
  return (
    <div className="content-stretch flex flex-col gap-[7.438px] items-center px-[3.719px] py-0 relative shrink-0" data-name="Tab 2">
      <Group7 />
      <p className="css-4hzbpn font-['SF_Compact_Display:Semibold',sans-serif] leading-[normal] not-italic relative shrink-0 text-[#1c1b1f] text-[12.087px] text-center tracking-[0.1859px] w-[65.082px]">Pizza</p>
    </div>
  );
}

function RamenDining1() {
  return (
    <div className="relative shrink-0 size-[22.314px]" data-name="ramen_dining">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 22.3138 22.3138">
        <g id="ramen_dining">
          <mask height="23" id="mask0_1_383" maskUnits="userSpaceOnUse" style={{ maskType: "alpha" }} width="23" x="0" y="0">
            <rect fill="var(--fill-0, #D9D9D9)" height="22.3138" id="Bounding box" width="22.3138" />
          </mask>
          <g mask="url(#mask0_1_383)">
            <path d={svgPaths.p1a76ca80} fill="var(--fill-0, #EEF1F4)" id="ramen_dining_2" />
          </g>
        </g>
      </svg>
    </div>
  );
}

function Group8() {
  return (
    <div className="bg-[rgba(128,128,128,0.55)] content-stretch flex items-center overflow-clip p-[18.595px] relative rounded-[29.752px] shrink-0">
      <RamenDining1 />
    </div>
  );
}

function Tab8() {
  return (
    <div className="content-stretch flex flex-col gap-[7.438px] items-center px-[3.719px] py-0 relative shrink-0" data-name="Tab 4">
      <Group8 />
      <p className="css-ew64yg font-['SF_Compact_Display:Semibold',sans-serif] leading-[normal] not-italic relative shrink-0 text-[#1c1b1f] text-[12.087px] text-center tracking-[0.1859px]">Ramen</p>
    </div>
  );
}

function Fastfood1() {
  return (
    <div className="relative shrink-0 size-[22.314px]" data-name="fastfood">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 22.3138 22.3138">
        <g id="fastfood">
          <mask height="23" id="mask0_1_338" maskUnits="userSpaceOnUse" style={{ maskType: "alpha" }} width="23" x="0" y="0">
            <rect fill="var(--fill-0, #D9D9D9)" height="22.3138" id="Bounding box" width="22.3138" />
          </mask>
          <g mask="url(#mask0_1_338)">
            <path d={svgPaths.p2ce1ca80} fill="var(--fill-0, #EEF1F4)" id="fastfood_2" />
          </g>
        </g>
      </svg>
    </div>
  );
}

function Frame3() {
  return (
    <div className="bg-[rgba(128,128,128,0.55)] content-stretch flex items-center p-[18.595px] relative rounded-[29.752px] shrink-0">
      <Fastfood1 />
    </div>
  );
}

function Tab9() {
  return (
    <div className="content-stretch flex flex-col gap-[7.438px] items-center px-[3.719px] py-0 relative shrink-0" data-name="Tab 6">
      <Frame3 />
      <p className="css-4hzbpn font-['SF_Compact_Display:Semibold',sans-serif] leading-[normal] not-italic relative shrink-0 text-[#1c1b1f] text-[12.087px] text-center tracking-[0.1859px] w-[65.082px]">Burger</p>
    </div>
  );
}

function TabBarButtons1() {
  return (
    <div className="content-stretch flex gap-[3.719px] items-start px-[14.876px] py-0 relative shrink-0" data-name="Tab Bar Buttons">
      <Tab2 />
      <Tab6 />
      <Tab7 />
      <Tab8 />
      <Tab9 />
    </div>
  );
}

function ViewCategoriesNavigationBar1() {
  return (
    <div className="absolute content-stretch flex flex-col h-[111.569px] items-start justify-between left-[14px] overflow-clip px-0 py-[14.876px] top-[628px] w-[397px]" data-name="View / Categories Navigation Bar">
      <TabBarButtons1 />
    </div>
  );
}

function Group4() {
  return (
    <div className="absolute contents left-[14px] top-[532px]">
      <ViewCategoriesNavigationBar />
      <ViewCategoriesNavigationBar1 />
    </div>
  );
}

function ImagePlaceholder4() {
  return (
    <div className="absolute h-[367px] left-[24px] top-[125px] w-[383px]" data-name="Image placeholder">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 383 367">
        <g data-figma-bg-blur-radius="40" id="Image placeholder">
          <rect fill="var(--fill-0, #EEF1F4)" height="367" rx="18.31" width="383" />
          <g id="Icons">
            <path d={svgPaths.p31e73f0} id="Vector" stroke="var(--stroke-0, #667080)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
            <path d={svgPaths.p27e4ae80} id="Vector_2" stroke="var(--stroke-0, #667080)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
            <path d="M201 186L196 181L185 192" id="Vector_3" stroke="var(--stroke-0, #667080)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
          </g>
        </g>
        <defs>
          <clipPath id="bgblur_0_1_324_clip_path" transform="translate(40 40)">
            <rect height="367" rx="18.31" width="383" />
          </clipPath>
        </defs>
      </svg>
    </div>
  );
}

function Frame4() {
  return (
    <div className="absolute content-stretch flex items-start left-[192px] rounded-[166.667px] size-[10px] top-[504px]">
      <div className="bg-black rounded-[83.333px] shrink-0 size-[10px]" />
    </div>
  );
}

function Group3() {
  return (
    <div className="absolute contents left-[192px] top-[504px]">
      <Frame4 />
      <div className="absolute bg-[#c3c6c9] left-[208.67px] rounded-[83.333px] size-[10px] top-[504px]" />
      <div className="absolute bg-[#c3c6c9] left-[225.33px] rounded-[83.333px] size-[10px] top-[504px]" />
    </div>
  );
}

function Group5() {
  return (
    <div className="absolute contents left-[24px] top-[125px]">
      <ImagePlaceholder4 />
      <Group3 />
    </div>
  );
}

export default function HomeScreen() {
  return (
    <div className="bg-[#f8f8f8] overflow-clip relative rounded-[50px] shadow-[0px_20px_104px_0px_rgba(0,0,0,0.1)] size-full" data-name="Home Screen">
      <Stores />
      <Arrival />
      <ImagePlaceholder2 />
      <ImagePlaceholder3 />
      <TopNav />
      <Nav />
      <Group4 />
      <Group5 />
    </div>
  );
}