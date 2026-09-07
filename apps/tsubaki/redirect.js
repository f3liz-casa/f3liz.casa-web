// tsubaki.f3liz.casa moved into the house, to f3liz.casa/tsubaki/.
// This worker only points the way for old links.
export default {
  fetch(request) {
    const url = new URL(request.url);
    return Response.redirect("https://f3liz.casa/tsubaki/" + url.search, 301);
  },
};
