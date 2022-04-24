FROM ubuntu:latest

RUN apt-get -y update

RUN apt-get -y install wget curl

WORKDIR /usr/src

RUN wget https://github.com/dogecoin/dogecoin/releases/download/v1.14.4/dogecoin-1.14.4-x86_64-linux-gnu.tar.gz
RUN tar -xzvf dogecoin-1.14.4-x86_64-linux-gnu.tar.gz
RUN chmod +x dogecoin-1.14.4/bin/dogecoind dogecoin-1.14.4/bin/dogecoin-cli
RUN ln -s /usr/src/dogecoin-1.14.4/bin/dogecoind /usr/bin/dogecoind
RUN ln -s /usr/src/dogecoin-1.14.4/bin/dogecoin-cli /usr/bin/dogecoin-cli

EXPOSE 22555 22556 44555 44556 18444 18443

CMD ["dogecoind", "-printtoconsole"]
