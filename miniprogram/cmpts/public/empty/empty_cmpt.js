Component({
  options: {
    addGlobalClass: true,
    multipleSlots: true,
    virtualHost: true,
  },

  externalClasses: ["custom-class", "image-class", "description-class"],

  properties: {
    image: {
      type: String,
      value: "/images/empty_yoga.png",
    },
    description: String,
    imageSize: {
      type: null,
      value: "",
    },
  },
});
