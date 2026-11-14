/** Ô Kiểu dáng riêng của khối lõi (@ecomcx/ecomweb-content core-controls) + ô Nền thống nhất. Khoá = tên thuộc tính / mục / giá trị. */
export const blockStyle = {
  tabContent: "Nội dung",
  tabStyle: "Kiểu dáng",
  tabAdvanced: "Nâng cao",
  normal: "Thường",
  hover: "Rê chuột",
  active: "Đang mở",
  /** Mục của tab Kiểu dáng. */
  section: {
    text: "Chữ", list: "Danh sách", button: "Nút", image: "Ảnh", table: "Bảng", tabs: "Tabs", accordion: "Accordion", columns: "Cột",
    separator: "Đường kẻ", icon: "Icon", content: "Tiêu đề & chữ", number: "Con số", box: "Khung", bar: "Thanh",
  },
  /** Tên ô (thuộc tính). */
  attr: {
    textShadow: "Bóng chữ",
    listMarker: "Kiểu dấu đầu dòng", listMarkerColor: "Màu dấu", listGap: "Khoảng giữa các mục", listDivider: "Đường kẻ giữa các mục",
    buttonColor: "Màu chữ", buttonBg: "Màu nền", buttonHoverColor: "Màu chữ", buttonHoverBg: "Màu nền", buttonSize: "Cỡ nút", buttonRadius: "Bo góc", buttonWeight: "Độ đậm chữ", buttonShadow: "Đổ bóng",
    imageWidth: "Chiều rộng", imageHeight: "Chiều cao", imageFit: "Cách phủ", imageRadius: "Bo góc", imageBorderWidth: "Độ dày viền", imageBorderColor: "Màu viền", imageShadow: "Đổ bóng",
    imageOpacity: "Độ trong", imageFilter: "Bộ lọc màu", imageHoverEffect: "Hiệu ứng", imageHoverOpacity: "Độ trong", imageHoverFilter: "Bộ lọc màu",
    tableBorderColor: "Màu viền ô", tableBorderWidth: "Độ dày viền ô", tableHeaderBg: "Nền hàng tiêu đề", tableHeaderColor: "Chữ hàng tiêu đề", tableStripe: "Màu hàng xen kẽ", tableCellPadding: "Khoảng đệm ô", tableAlign: "Căn chữ trong ô",
    tabsTitleColor: "Màu tiêu đề", tabsTitleBg: "Nền tiêu đề", tabsActiveColor: "Màu tiêu đề", tabsActiveBg: "Nền tiêu đề", tabsAccent: "Gạch chân", tabsBorderColor: "Màu đường kẻ", tabsGap: "Khoảng giữa tiêu đề", tabsContentPadding: "Khoảng đệm nội dung",
    accTitleColor: "Màu tiêu đề", accTitleBg: "Nền tiêu đề", accActiveColor: "Màu tiêu đề", accBorderColor: "Màu viền", accGap: "Khoảng giữa các mục", accPadding: "Khoảng đệm",
    columnsGap: "Khoảng giữa các cột", columnsDirection: "Hướng xếp",
    hrStyle: "Kiểu", hrWeight: "Độ dày", hrColor: "Màu", hrWidth: "Chiều rộng", hrAlign: "Căn",
    iconBoxIconColor: "Màu icon", iconBoxIconSize: "Cỡ icon", iconBoxTitleColor: "Màu tiêu đề", iconBoxTextColor: "Màu mô tả",
    imageBoxRadius: "Bo góc ảnh", imageBoxTitleColor: "Màu tiêu đề", imageBoxTextColor: "Màu mô tả",
    iconListGap: "Khoảng giữa các mục", iconListDivider: "Đường kẻ giữa các mục", iconListIconColor: "Màu icon", iconListIconSize: "Cỡ icon", iconListTextColor: "Màu chữ",
    counterNumberColor: "Màu số", counterNumberSize: "Cỡ số", counterTitleColor: "Màu tiêu đề",
    testimonialBg: "Màu nền", testimonialBorderColor: "Màu viền", testimonialQuoteColor: "Màu lời chứng thực", testimonialNameColor: "Màu tên", testimonialRoleColor: "Màu chức danh",
    progressBarColor: "Màu thanh", progressTrackColor: "Màu rãnh", progressHeight: "Độ cao thanh", progressTitleColor: "Màu tiêu đề",
  },
  /** Nhãn giá trị của ô chọn. */
  opt: {
    sm: "Nhỏ", md: "Vừa", lg: "Lớn", xl: "Rất lớn", xs: "Rất nhỏ",
    disc: "• Chấm tròn", circle: "○ Vòng tròn", square: "■ Vuông", decimal: "1. Số", "decimal-leading-zero": "01. Số có 0", "lower-alpha": "a. Chữ thường", "upper-alpha": "A. Chữ hoa",
    "lower-roman": "i. La Mã thường", "upper-roman": "I. La Mã hoa", check: "✓ Dấu tích", arrow: "→ Mũi tên", dash: "– Gạch ngang", none: "Không",
    cover: "Phủ kín", contain: "Vừa khung",
    grayscale: "Đen trắng", sepia: "Màu cũ", blur: "Làm mờ", bright: "Sáng hơn", dim: "Tối hơn", saturate: "Rực hơn",
    zoom: "Phóng to", lift: "Nhấc lên", tilt: "Nghiêng",
    start: "Đầu", center: "Giữa", end: "Cuối",
    row: "Ngang", "row-reverse": "Ngang, đảo thứ tự", column: "Xếp dọc", "column-reverse": "Xếp dọc, đảo thứ tự",
    solid: "Liền", dashed: "Gạch", dotted: "Chấm", double: "Đôi",
    "400": "Thường", "500": "Vừa", "600": "Hơi đậm", "700": "Đậm", "800": "Rất đậm",
  },
  /** Ô Nền thống nhất (như nhóm Background của Elementor). */
  bg: {
    title: "Nền",
    type: "Loại nền",
    color: "Màu",
    gradient: "Chuyển màu",
    image: "Ảnh",
    hoverColor: "Màu nền khi rê chuột",
    hoverNote: "Rê chuột chỉ đổi màu nền; ảnh / chuyển màu giữ nguyên.",
    legacy: "Màu nền cũ của nhóm — chọn màu khác để chuyển sang kiểu dáng mới.",
  },
  tabTitle: "Tab {n}",
};
